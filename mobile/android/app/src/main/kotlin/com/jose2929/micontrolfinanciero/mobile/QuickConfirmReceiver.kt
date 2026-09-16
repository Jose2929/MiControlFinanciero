package com.jose2929.micontrolfinanciero.mobile

import android.app.NotificationManager
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/**
 * Fase 15.1: recibe el toque de "Aceptar" en la notificacion de
 * "Gasto/Ingreso detectado" — desde el telefono o desde la copia
 * reflejada en un reloj Wear OS emparejado (ver docs/plan-app-flutter-
 * notificaciones.md Fase 15). Dispara el mismo motor headless que ya usa
 * `NotificationListener` (Fase 7), agregando `"kind": "quick_confirm"`
 * para que el entrypoint Dart escriba el movimiento directo a Firebase
 * en vez de solo parsear y notificar.
 */
class QuickConfirmReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val timestamp = intent.getLongExtra(NotificationPoster.EXTRA_TIMESTAMP, 0L)

        if (timestamp != 0L) {
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.cancel(timestamp.toInt())
        }

        val event = mapOf(
            "kind" to "quick_confirm",
            "packageName" to intent.getStringExtra(NotificationPoster.EXTRA_PACKAGE_NAME),
            "amount" to intent.getDoubleExtra(NotificationPoster.EXTRA_AMOUNT, 0.0),
            "note" to intent.getStringExtra(NotificationPoster.EXTRA_NOTE),
            "timestamp" to timestamp,
            "type" to intent.getStringExtra(NotificationPoster.EXTRA_TYPE)
        )

        BackgroundEngineManager.dispatch(context.applicationContext, event)
    }
}
