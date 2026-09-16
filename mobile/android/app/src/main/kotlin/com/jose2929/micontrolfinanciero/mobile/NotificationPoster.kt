package com.jose2929.micontrolfinanciero.mobile

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build

// Fase 7: publica la notificacion de "movimiento detectado" que dispara
// el engine headless al procesar una notificacion real.
object NotificationPoster {
    // No privado: NotificationListener lo usa para nunca reprocesar sus
    // propias notificaciones de "movimiento detectado" (evita un bucle
    // infinito de auto-retroalimentacion).
    const val DETECTED_CHANNEL_ID = "mcf_detected_channel"

    // Extras del Intent que abre MainActivity al tocar la notificacion
    // propia. Fase 9 (pantalla de confirmacion real) los leera; por ahora
    // solo viajan listos.
    const val EXTRA_ACTION = "mcf_action"
    const val EXTRA_PACKAGE_NAME = "mcf_package_name"
    const val EXTRA_AMOUNT = "mcf_amount"
    const val EXTRA_NOTE = "mcf_note"
    const val EXTRA_TIMESTAMP = "mcf_timestamp"
    const val EXTRA_TYPE = "mcf_type"
    const val ACTION_CONFIRM_MOVEMENT = "confirm_movement"

    fun postDetectedMovement(
        context: Context,
        title: String,
        text: String,
        sourcePackageName: String,
        amount: Double,
        note: String?,
        timestamp: Long,
        type: String
    ) {
        ensureChannel(context, DETECTED_CHANNEL_ID, "Movimientos detectados")

        val notificationManager =
            context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

        val intent = Intent(context, MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP
            putExtra(EXTRA_ACTION, ACTION_CONFIRM_MOVEMENT)
            putExtra(EXTRA_PACKAGE_NAME, sourcePackageName)
            putExtra(EXTRA_AMOUNT, amount)
            putExtra(EXTRA_NOTE, note)
            putExtra(EXTRA_TIMESTAMP, timestamp)
            putExtra(EXTRA_TYPE, type)
        }

        val pendingIntent = PendingIntent.getActivity(
            context,
            timestamp.toInt(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        // Fase 15.1: "Aceptar" registra el movimiento de una vez (primera
        // cuenta/categoria del hogar, sin abrir ninguna pantalla) via
        // QuickConfirmReceiver — pensado para tocarse desde la copia
        // reflejada de esta notificacion en un reloj Wear OS emparejado,
        // donde no hay forma de abrir la app. getBroadcast (no getActivity):
        // no debe traer el telefono al frente.
        val quickConfirmIntent = Intent(context, QuickConfirmReceiver::class.java).apply {
            putExtra(EXTRA_PACKAGE_NAME, sourcePackageName)
            putExtra(EXTRA_AMOUNT, amount)
            putExtra(EXTRA_NOTE, note)
            putExtra(EXTRA_TIMESTAMP, timestamp)
            putExtra(EXTRA_TYPE, type)
        }
        val quickConfirmPendingIntent = PendingIntent.getBroadcast(
            context,
            timestamp.toInt(),
            quickConfirmIntent,
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = Notification.Builder(context, DETECTED_CHANNEL_ID)
            .setContentTitle(title)
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_dialog_info)
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .addAction(0, "Aceptar", quickConfirmPendingIntent)
            .addAction(0, "Revisar movimiento", pendingIntent)
            .build()

        notificationManager.notify(timestamp.toInt(), notification)
    }

    private fun ensureChannel(context: Context, channelId: String, name: String) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val notificationManager =
                context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
            notificationManager.createNotificationChannel(
                NotificationChannel(channelId, name, NotificationManager.IMPORTANCE_DEFAULT)
            )
        }
    }
}
