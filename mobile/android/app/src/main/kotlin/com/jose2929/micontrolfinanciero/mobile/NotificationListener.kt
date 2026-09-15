package com.jose2929.micontrolfinanciero.mobile

import android.app.Notification
import android.content.pm.PackageManager
import android.os.Build
import android.service.notification.NotificationListenerService
import android.service.notification.StatusBarNotification
import android.util.Log
import io.flutter.plugin.common.EventChannel

class NotificationListener : NotificationListenerService() {

    companion object {
        private const val TAG = "MCF_NotificationListener"

        var eventSink: EventChannel.EventSink? = null
    }

    override fun onNotificationPosted(sbn: StatusBarNotification) {
        // Nunca reprocesar nuestra propia notificacion de "movimiento
        // detectado": sin este corte, su texto (que incluye un monto)
        // volveria a parsearse y generaria otra notificacion igual, en un
        // bucle infinito.
        val channelId = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            sbn.notification.channelId
        } else {
            null
        }
        if (channelId == NotificationPoster.DETECTED_CHANNEL_ID) {
            return
        }

        val packageName = sbn.packageName
        val enabledPackages = MonitoredAppsPrefs.getEnabledPackages(applicationContext)
        if (packageName !in enabledPackages) {
            return
        }

        val extras = sbn.notification.extras
        val title = extras.getCharSequence(Notification.EXTRA_TITLE)?.toString() ?: ""
        val text = extras.getCharSequence(Notification.EXTRA_TEXT)?.toString() ?: ""
        val appName = try {
            val appInfo = packageManager.getApplicationInfo(packageName, 0)
            packageManager.getApplicationLabel(appInfo).toString()
        } catch (e: PackageManager.NameNotFoundException) {
            packageName
        }
        val timestamp = sbn.postTime

        Log.d(TAG, "packageName=$packageName appName=$appName title=$title text=$text timestamp=$timestamp")

        val event = mapOf(
            "packageName" to packageName,
            "appName" to appName,
            "title" to title,
            "text" to text,
            "timestamp" to timestamp
        )

        eventSink?.success(event)

        // Fase 7: procesar el evento en segundo plano (parser + dedup +
        // notificacion propia) sin importar si la UI de Flutter esta
        // abierta o no.
        BackgroundEngineManager.dispatch(applicationContext, event)
    }
}
