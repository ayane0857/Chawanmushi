package org.chawanmushi.plugin

import com.google.gson.JsonParser
import org.bukkit.Bukkit
import org.bukkit.GameRule
import org.bukkit.Location
import org.bukkit.Material
import org.bukkit.World
import org.bukkit.WorldCreator
import org.bukkit.entity.Player
import org.bukkit.configuration.file.YamlConfiguration
import org.bukkit.event.EventHandler
import org.bukkit.event.Listener
import org.bukkit.event.entity.EntityDamageEvent
import org.bukkit.event.entity.FoodLevelChangeEvent
import org.bukkit.event.player.PlayerJoinEvent
import org.bukkit.event.player.PlayerMoveEvent
import org.bukkit.event.player.PlayerQuitEvent
import org.bukkit.generator.ChunkGenerator
import org.bukkit.plugin.java.JavaPlugin
import org.bukkit.scheduler.BukkitTask
import java.io.File
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets
import java.time.Duration
import java.util.concurrent.ConcurrentHashMap
import java.util.Random
import java.util.UUID


/** 何も生成しない(=虚無)ジェネレーター */
class VoidGenerator : ChunkGenerator() {
    override fun getFixedSpawnLocation(world: World, random: Random): Location =
        Location(world, 0.5, 65.0, 0.5)
}

class Plugin : JavaPlugin(), Listener {

    private data class PlayerState(
        val origin: Location,
        val wasInvulnerable: Boolean,
    )

    companion object {
        const val VOID_WORLD_NAME = "void_world"
        const val CONFIG_FILE_NAME = "chawanmushi_config.yml"
        const val RETRY_TICKS = 200L // 10秒
    }

    private lateinit var voidWorld: World
    private lateinit var configFile: File

    private val tasks = HashMap<UUID, BukkitTask>()
    private val playerStates = HashMap<UUID, PlayerState>()
    private val lastAuthPrompts = HashMap<UUID, String>()
    private val allowedTeleports = HashSet<UUID>()
    private val requestsInFlight = ConcurrentHashMap.newKeySet<UUID>()
    private val httpClient = HttpClient.newBuilder()
        .connectTimeout(Duration.ofSeconds(5))
        .build()

    override fun onEnable() {
        configFile = File(dataFolder, CONFIG_FILE_NAME)
        if (!configFile.exists()) {
            saveResource(CONFIG_FILE_NAME, false)
        }

        val world = Bukkit.getWorld(VOID_WORLD_NAME)
            ?: WorldCreator(VOID_WORLD_NAME)
                .generator(VoidGenerator())
                .generateStructures(false)
                .createWorld()
        if (world == null) {
            logger.severe("虚無ワールドの作成に失敗しました")
            server.pluginManager.disablePlugin(this)
            return
        }
        voidWorld = world

        voidWorld.apply {
            setSpawnFlags(false, false)
            setGameRule(GameRule.DO_MOB_SPAWNING, false)
            setGameRule(GameRule.DO_DAYLIGHT_CYCLE, false)
            setGameRule(GameRule.DO_WEATHER_CYCLE, false)
            time = 6000
        }

        voidWorld.getBlockAt(0, 63, 0).type = Material.BARRIER

        server.pluginManager.registerEvents(this, this)
    }

    override fun onDisable() {
        tasks.values.forEach { it.cancel() }
        tasks.clear()

        if (this::voidWorld.isInitialized) {
            server.onlinePlayers.forEach { restore(it) }
            playerStates.clear()
        }
    }

    // 認証 API の結果に応じて、認証案内またはプレイヤーの復帰を行う
    private fun doProcess(uuid: UUID, url: String) {
        if (!requestsInFlight.add(uuid)) return

        try {
            val baseUrl = url.trim().trimEnd('/')
            require(baseUrl.isNotEmpty()) { "設定 URL が空です" }

            val uri = URI.create("$baseUrl/api/device/resolve?uuid=$uuid")
            val request = HttpRequest.newBuilder()
                .uri(uri)
                .timeout(Duration.ofSeconds(10))
                .header("Accept", "application/json")
                .GET()
                .build()

            logger.info("HTTPリクエスト送信: $uri")
            httpClient.sendAsync(request, HttpResponse.BodyHandlers.ofString())
                .whenComplete { response, error ->
                    try {
                        when {
                            error != null -> {
                                val cause = error.cause ?: error
                                logger.warning("HTTPリクエスト失敗 (UUID: $uuid): ${cause.message}")
                            }
                            response == null -> logger.warning("HTTPレスポンスが空です (UUID: $uuid)")
                            response.statusCode() !in 200..299 -> {
                                logger.warning("HTTPエラー (UUID: $uuid, Status: ${response.statusCode()}): ${response.body()}")
                            }
                            else -> {
                                logger.info("HTTPレスポンス受信 (UUID: $uuid, Status: ${response.statusCode()})")
                                logger.info("Body: ${response.body()}")
                                logger.info("Headers: ${response.headers()}")

                                val data = try {
                                    JsonParser.parseString(response.body()).asJsonObject
                                } catch (parseError: Exception) {
                                    logger.warning("JSONの解析に失敗しました (UUID: $uuid): ${parseError.message}")
                                    return@whenComplete
                                }

                                val isRegistered = data.get("Registration")
                                    ?.let { !it.isJsonNull && it.asBoolean }
                                    ?: false

                                if (isRegistered) {
                                    server.scheduler.runTask(this, Runnable {
                                        val player = Bukkit.getPlayer(uuid) ?: return@Runnable
                                        if (restore(player)) {
                                            tasks.remove(uuid)?.cancel()
                                            lastAuthPrompts.remove(uuid)
                                        }
                                    })
                                } else {
                                    val code = data.get("code")
                                        ?.let { if (it.isJsonNull) null else it.asString }
                                    if (code.isNullOrBlank()) {
                                        logger.warning("レスポンスに認証コードがありません (UUID: $uuid)")
                                    } else {
                                        val authUrl = "$baseUrl/device?code=${URLEncoder.encode(code, StandardCharsets.UTF_8)}"
                                        server.scheduler.runTask(this, Runnable {
                                            val player = Bukkit.getPlayer(uuid) ?: return@Runnable
                                            if (lastAuthPrompts[uuid] == authUrl) return@Runnable
                                            lastAuthPrompts[uuid] = authUrl
                                            player.sendMessage("認証してください。$authUrl")
                                        })
                                    }
                                }
                            }
                        }
                    } catch (callbackError: Exception) {
                        logger.warning("HTTPレスポンスの処理に失敗しました (UUID: $uuid): ${callbackError.message}")
                    } finally {
                        requestsInFlight.remove(uuid)
                    }
                }
        } catch (error: Exception) {
            requestsInFlight.remove(uuid)
            logger.warning("HTTPリクエストを開始できません (UUID: $uuid): ${error.message}")
        }

    }

    private fun voidSpawn() = Location(voidWorld, 0.5, 64.0, 0.5)

    private fun startChecking(player: Player) {
        val uuid = player.uniqueId
        tasks.remove(uuid)?.cancel()

        // ログイン時に設定を読み込み直し、URLを取得
        val url = YamlConfiguration.loadConfiguration(configFile).getString("url") ?: ""

        tasks[uuid] = server.scheduler.runTaskTimer(this, Runnable {
            if (!player.isOnline) {
                tasks.remove(uuid)?.cancel()
                return@Runnable
            }

            doProcess(uuid, url)

            if (player.world != voidWorld) {
                val state = playerStates.getOrPut(uuid) {
                    PlayerState(player.location.clone(), player.isInvulnerable)
                }
                player.isInvulnerable = true
                if (!teleport(player, voidSpawn())) {
                    player.isInvulnerable = state.wasInvulnerable
                }
            }
        }, 1L, RETRY_TICKS)
    }

    private fun restore(player: Player): Boolean {
        val uuid = player.uniqueId
        val state = playerStates[uuid]
        val wasWaiting = player.world == voidWorld

        if (wasWaiting) {
            val fallback = server.worlds.firstOrNull { it != voidWorld }?.spawnLocation
                ?: return false
            if (!teleport(player, state?.origin ?: fallback)) return false
        }

        playerStates.remove(uuid)
        if (state != null) {
            player.isInvulnerable = state.wasInvulnerable
        } else if (wasWaiting) {
            player.isInvulnerable = false
        }
        return true
    }

    private fun teleport(player: Player, destination: Location): Boolean {
        val uuid = player.uniqueId
        allowedTeleports.add(uuid)
        return try {
            player.teleport(destination)
        } finally {
            allowedTeleports.remove(uuid)
        }
    }

    @EventHandler
    fun onJoin(e: PlayerJoinEvent) = startChecking(e.player)

    @EventHandler
    fun onQuit(e: PlayerQuitEvent) {
        val p = e.player
        tasks.remove(p.uniqueId)?.cancel()
        lastAuthPrompts.remove(p.uniqueId)
        playerStates[p.uniqueId]?.let { p.isInvulnerable = it.wasInvulnerable }
    }

    @EventHandler
    fun onMove(e: PlayerMoveEvent) {
        if (e.player.uniqueId in allowedTeleports || e.from.world != voidWorld) return

        val to = e.to ?: return
        if (e.from.world == to.world &&
            e.from.x == to.x && e.from.y == to.y && e.from.z == to.z
        ) return

        e.to = e.from.clone().apply {
            yaw = to.yaw
            pitch = to.pitch
        }
    }

    @EventHandler
    fun onDamage(e: EntityDamageEvent) {
        val p = e.entity as? Player ?: return
        if (p.world == voidWorld) e.isCancelled = true
    }

    @EventHandler
    fun onHunger(e: FoodLevelChangeEvent) {
        val p = e.entity as? Player ?: return
        if (p.world == voidWorld) e.isCancelled = true
    }
}
