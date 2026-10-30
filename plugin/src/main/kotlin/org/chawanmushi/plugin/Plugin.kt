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
import org.bukkit.event.block.BlockBreakEvent
import org.bukkit.event.block.BlockPlaceEvent
import org.bukkit.event.entity.EntityDamageByEntityEvent
import org.bukkit.event.entity.EntityDamageEvent
import org.bukkit.event.entity.FoodLevelChangeEvent
import org.bukkit.event.inventory.InventoryClickEvent
import org.bukkit.event.player.AsyncPlayerChatEvent
import org.bukkit.event.player.PlayerCommandPreprocessEvent
import org.bukkit.event.player.PlayerDropItemEvent
import org.bukkit.event.player.PlayerInteractEvent
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

    // 解除するための合言葉
    private val unlockWord = "unlock"

    // 1人ごとの間隔(ブロック)
    private val spacing = 100

    // ロビーの高さ
    private val lobbyY = 100

    private lateinit var lobby: World

    // まだ解除していないプレイヤー
    private val locked: MutableSet<UUID> = ConcurrentHashMap.newKeySet()

    // プレイヤー -> 割り当てられた区画番号
    private val slots = ConcurrentHashMap<UUID, Int>()

    // ロビーに送る前の元の場所を保存するファイル
    private val originFile by lazy { File(dataFolder, "origins.yml") }
    private val origins = YamlConfiguration()

    override fun onEnable() {
        dataFolder.mkdirs()
        if (originFile.exists()) origins.load(originFile)

        // 専用ワールド(ディメンション)を作成
        lobby = WorldCreator("verify_lobby")
            .generator(VoidGenerator())
            .environment(World.Environment.NORMAL) // THE_END にすると見た目が変わる
            .createWorld()!!
        lobby.difficulty = Difficulty.PEACEFUL
        lobby.setSpawnLocation(0, lobbyY + 1, 0)
        lobby.time = 6000
        lobby.setStorm(false)

        server.pluginManager.registerEvents(this, this)
    }

    override fun onDisable() {
        saveOrigins()
        locked.clear()
        slots.clear()
    }

    // ---------- 区画まわり ----------

    private fun nextSlot(): Int {
        val used = slots.values.toSet()
        var i = 0
        while (i in used) i++
        return i
    }

    private fun slotLocation(slot: Int) =
        Location(lobby, slot * spacing + 0.5, lobbyY + 1.0, 0.5)

    /** その区画に5x5の足場を作る */
    private fun buildPlatform(slot: Int) {
        val cx = slot * spacing
        for (dx in -2..2) for (dz in -2..2) {
            lobby.getBlockAt(cx + dx, lobbyY, dz).type = Material.GLASS
        }
    }

    private fun saveOrigins() {
        try { origins.save(originFile) } catch (ex: Exception) { logger.warning("origins.yml の保存に失敗: ${ex.message}") }
    }

    private fun isLocked(player: Player) = locked.contains(player.uniqueId)

    // ---------- ログイン / ログアウト ----------

    @EventHandler
    fun onJoin(e: PlayerJoinEvent) {
        val p = e.player

        // すでにロビーにいる(ロック中に落ちた)場合は元の場所を上書きしない
        if (p.world != lobby) {
            origins.set("origins.${p.uniqueId}", p.location)
            saveOrigins()
        }

        val slot = nextSlot()
        slots[p.uniqueId] = slot
        locked.add(p.uniqueId)

        buildPlatform(slot)
        p.teleport(slotLocation(slot))

        p.sendMessage("Hello, World")
        p.sendMessage("チャット欄に「$unlockWord」と送ると遊べるようになります。")
    }

    @EventHandler
    fun onQuit(e: PlayerQuitEvent) {
        locked.remove(e.player.uniqueId)
        slots.remove(e.player.uniqueId) // 区画を空けて次の人が使えるようにする
    }

    // ---------- チャットで解除 ----------

    @EventHandler(priority = EventPriority.LOWEST)
    fun onChat(e: AsyncPlayerChatEvent) {
        val player = e.player
        if (!isLocked(player)) return

        e.isCancelled = true

        if (e.message.trim().equals(unlockWord, ignoreCase = true)) {
            server.scheduler.runTask(this, Runnable { unlock(player) })
        } else {
            player.sendMessage("「$unlockWord」と送ってください。")
        }
    }

    private fun unlock(player: Player) {
        locked.remove(player.uniqueId)
        slots.remove(player.uniqueId)

        val key = "origins.${player.uniqueId}"
        val origin = origins.getLocation(key)
            ?: server.worlds.first { it != lobby }.spawnLocation
        origins.set(key, null)
        saveOrigins()

        player.teleport(origin)
        player.sendMessage("解除しました!自由に遊べます。")
    }

    // ---------- 未解除の間はできないこと ----------

    @EventHandler
    fun onMove(e: PlayerMoveEvent) {
        if (!isLocked(e.player)) return
        val from = e.from
        val to = e.to
        if (from.x != to.x || from.y != to.y || from.z != to.z) {
            e.setTo(from.clone().apply {
                yaw = to.yaw
                pitch = to.pitch
            })
        }
    }

    @EventHandler
    fun onBreak(e: BlockBreakEvent) {
        if (isLocked(e.player)) e.isCancelled = true
    }

    @EventHandler
    fun onPlace(e: BlockPlaceEvent) {
        if (isLocked(e.player)) e.isCancelled = true
    }

    @EventHandler
    fun onInteract(e: PlayerInteractEvent) {
        if (isLocked(e.player)) e.isCancelled = true
    }

    @EventHandler
    fun onDrop(e: PlayerDropItemEvent) {
        if (isLocked(e.player)) e.isCancelled = true
    }

    @EventHandler
    fun onInventoryClick(e: InventoryClickEvent) {
        val p = e.whoClicked as? Player ?: return
        if (isLocked(p)) e.isCancelled = true
    }

    @EventHandler
    fun onCommand(e: PlayerCommandPreprocessEvent) {
        if (isLocked(e.player)) e.isCancelled = true
    }

    @EventHandler
    fun onAttack(e: EntityDamageByEntityEvent) {
        val damager = e.damager as? Player
        if (damager != null && isLocked(damager)) e.isCancelled = true
    }

    @EventHandler
    fun onDamage(e: EntityDamageEvent) {
        val victim = e.entity as? Player ?: return
        if (isLocked(victim)) e.isCancelled = true
    }

    @EventHandler
    fun onHunger(e: FoodLevelChangeEvent) {
        val p = e.entity as? Player ?: return
        if (isLocked(p)) e.isCancelled = true
    }
}