package com.jose2929.micontrolfinanciero.mobile.wear

import androidx.wear.protolayout.ActionBuilders
import androidx.wear.protolayout.LayoutElementBuilders
import androidx.wear.protolayout.ModifiersBuilders
import androidx.wear.protolayout.ResourceBuilders
import androidx.wear.protolayout.TimelineBuilders
import androidx.wear.protolayout.material.Chip
import androidx.wear.tiles.RequestBuilders
import androidx.wear.tiles.TileBuilders
import androidx.wear.tiles.TileService
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * Fase 15.2: Tile glanceable con un solo botón ("Gasto por voz") que abre
 * [VoiceExpenseActivity] — capturar el gasto en efectivo por voz sin
 * pasar por la app completa. Se agrega al reloj manualmente (mantener
 * presionada la esfera → Tiles → agregar), no aparece sola.
 */
class VoiceExpenseTileService : TileService() {

    override fun onTileRequest(
        requestParams: RequestBuilders.TileRequest,
    ): ListenableFuture<TileBuilders.Tile> {
        val launchAction = ActionBuilders.LaunchAction.Builder()
            .setAndroidActivity(
                ActionBuilders.AndroidActivity.Builder()
                    .setPackageName(packageName)
                    .setClassName(VoiceExpenseActivity::class.java.name)
                    .build(),
            )
            .build()

        val clickable = ModifiersBuilders.Clickable.Builder()
            .setId("voice_expense")
            .setOnClick(launchAction)
            .build()

        val chip = Chip.Builder(this, clickable, requestParams.deviceConfiguration)
            .setPrimaryLabelContent("Gasto por voz")
            .build()

        val root = LayoutElementBuilders.Box.Builder()
            .addContent(chip)
            .build()

        val tile = TileBuilders.Tile.Builder()
            .setResourcesVersion(RESOURCES_VERSION)
            .setTileTimeline(
                TimelineBuilders.Timeline.Builder()
                    .addTimelineEntry(
                        TimelineBuilders.TimelineEntry.Builder()
                            .setLayout(
                                LayoutElementBuilders.Layout.Builder().setRoot(root).build(),
                            )
                            .build(),
                    )
                    .build(),
            )
            .build()

        return Futures.immediateFuture(tile)
    }

    override fun onTileResourcesRequest(
        requestParams: RequestBuilders.ResourcesRequest,
    ): ListenableFuture<ResourceBuilders.Resources> {
        return Futures.immediateFuture(
            ResourceBuilders.Resources.Builder().setVersion(RESOURCES_VERSION).build(),
        )
    }

    companion object {
        private const val RESOURCES_VERSION = "1"
    }
}
