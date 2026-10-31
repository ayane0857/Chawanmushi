package org.chawanmushi.plugin

import org.bukkit.Difficulty
import org.bukkit.Location
import org.bukkit.Material
import org.bukkit.World
import org.bukkit.WorldCreator
import org.bukkit.configuration.file.YamlConfiguration
import org.bukkit.entity.Player
import org.bukkit.event.EventHandler
import org.bukkit.event.EventPriority
import org.bukkit.event.Listener
import org.bukkit.event.entity.EntityDamageEvent
import org.bukkit.event.player.AsyncPlayerChatEvent
import org.bukkit.event.player.PlayerCommandPreprocessEvent
import org.bukkit.event.player.PlayerJoinEvent
import org.bukkit.event.player.PlayerMoveEvent
import org.bukkit.event.player.PlayerQuitEvent
import org.bukkit.generator.ChunkGenerator
import org.bukkit.plugin.java.JavaPlugin
import java.io.File
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/** 何も生成しない = 空っぽ(ボイド)のワールド */
class VoidGenerator : ChunkGenerator()

class Plugin : JavaPlugin(), Listener {

    private val lobbyY = 100

    private lateinit var lobby: World
    private lateinit var lobbySpawn: Location

    // まだ解除していないプレイヤー
    private val locked: MutableSet<UUID> = ConcurrentHashMap.newKeySet()

    // ロビーに送る前の元の場所
    private val originFile by lazy { File(dataFolder, "origins.yml") }
    private val origins = YamlConfiguration()

    override fun onEnable() {
        dataFolder.mkdirs()
        if (originFile.exists()) origins.load(originFile)

        lobby = WorldCreator("verify_lobby")
            .generator(VoidGenerator())
            .environment(World.Environment.NORMAL)
            .createWorld()!!
        lobby.difficulty = Difficulty.PEACEFUL
        lobby.time = 6000
        lobby.setStorm(false)

        for (dx in -2..2) for (dz in -2..2) {
            lobby.getBlockAt(dx, lobbyY, dz).type = Material.BARRIER
        }
        lobbySpawn = Location(lobby, 0.5, lobbyY + 1.0, 0.5)
        lobby.spawnLocation = lobbySpawn

        server.pluginManager.registerEvents(this, this)
    }

    override fun onDisable() {
        saveOrigins()
    }

    private fun saveOrigins() {
        try { origins.save(originFile) } catch (ex: Exception) {
            logger.warning("origins.yml の保存に失敗: ${ex.message}")
        }
    }

    private fun isLocked(player: Player) = locked.contains(player.uniqueId)

    // ---------- ログイン / ログアウト ----------

    @EventHandler
    fun onJoin(e: PlayerJoinEvent) {
        val p = e.player

        // ロック中に落ちて戻ってきた場合は元の場所を上書きしない
        if (p.world != lobby) {
            origins.set("origins.${p.uniqueId}", p.location)
            saveOrigins()
        }

        locked.add(p.uniqueId)
        p.teleport(lobbySpawn)
    }

    @EventHandler
    fun onQuit(e: PlayerQuitEvent) {
        locked.remove(e.player.uniqueId)
    }

    // ---------- 解除(別の方法からここを呼ぶ。メインスレッドで呼ぶこと) ----------

    fun unlock(player: Player) {
        locked.remove(player.uniqueId)

        val key = "origins.${player.uniqueId}"
        val origin = origins.getLocation(key)
            ?: server.worlds.first { it != lobby }.spawnLocation
        origins.set(key, null)
        saveOrigins()

        player.teleport(origin)
        player.sendMessage("解除しました!自由に遊べます。")
    }

    // ---------- 未解除の間: 動けない・死なない・喋れない ----------

    @EventHandler(priority = EventPriority.LOWEST)
    fun onChat(e: AsyncPlayerChatEvent) {
        if (isLocked(e.player)) e.isCancelled = true
    }

    @EventHandler
    fun onMove(e: PlayerMoveEvent) {
        if (!isLocked(e.player)) return
        val from = e.from
        val to = e.to
        if (from.x != to.x || from.y != to.y || from.z != to.z) {
            e.setTo(from.clone().apply { yaw = to.yaw; pitch = to.pitch })
        }
    }

    @EventHandler
    fun onDamage(e: EntityDamageEvent) {
        val victim = e.entity as? Player ?: return
        if (isLocked(victim)) e.isCancelled = true
    }

    @EventHandler
    fun onCommand(e: PlayerCommandPreprocessEvent) {
        if (isLocked(e.player)) e.isCancelled = true
    }
}