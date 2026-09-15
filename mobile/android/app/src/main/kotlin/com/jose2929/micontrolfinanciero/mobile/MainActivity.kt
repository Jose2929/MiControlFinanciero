package com.jose2929.micontrolfinanciero.mobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.provider.Settings
import android.util.Log
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.EventChannel
import io.flutter.plugin.common.MethodChannel

class MainActivity : FlutterActivity() {

    private val notificationsChannel = "mcf/notifications"
    private val notificationSettingsChannel = "mcf/notification_settings"
    private val monitoredAppsChannel = "mcf/monitored_apps"
    private val backgroundSetupChannel = "mcf/background_setup"
    private val dedupChannel = "mcf/dedup"
    private val confirmMovementChannel = "mcf/confirm_movement"
    private val postNotificationsRequestCode = 1001

    private var confirmMovementMethodChannel: MethodChannel? = null
    // Cold start (app abierta por la notificacion): se guarda aqui hasta que
    // Flutter lo pida via "takePendingConfirmMovement" (main.dart aun no ha
    // arrancado su MethodChannel cuando corre onCreate).
    private var pendingConfirmMovementExtras: Map<String, Any?>? = null

    override fun onCreate(savedInstanceState: android.os.Bundle?) {
        super.onCreate(savedInstanceState)
        requestPostNotificationsPermissionIfNeeded()
        handleConfirmMovementIntent(intent, isNewIntent = false)
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        handleConfirmMovementIntent(intent, isNewIntent = true)
    }

    // Fase 9: en cold start (app cerrada, se abre por la notificacion) los
    // extras se guardan para que Flutter los pida al arrancar. En warm start
    // (app ya corriendo, onNewIntent) el engine ya esta adjunto, asi que se
    // empujan directo por el MethodChannel sin esperar a que Flutter pregunte.
    private fun handleConfirmMovementIntent(intent: Intent, isNewIntent: Boolean) {
        if (intent.getStringExtra(NotificationPoster.EXTRA_ACTION) !=
            NotificationPoster.ACTION_CONFIRM_MOVEMENT
        ) {
            return
        }
        val extras = mapOf(
            "packageName" to intent.getStringExtra(NotificationPoster.EXTRA_PACKAGE_NAME),
            "amount" to intent.getDoubleExtra(NotificationPoster.EXTRA_AMOUNT, 0.0),
            "note" to intent.getStringExtra(NotificationPoster.EXTRA_NOTE),
            "timestamp" to intent.getLongExtra(NotificationPoster.EXTRA_TIMESTAMP, 0L),
            "type" to intent.getStringExtra(NotificationPoster.EXTRA_TYPE)
        )
        // Fase 16: $extras incluye monto/nota reales — no debe quedar en
        // logcat de un build de release.
        if (BuildConfig.DEBUG) {
            Log.d("MCF_MainActivity", "Movimiento a confirmar: $extras (isNewIntent=$isNewIntent)")
        }
        if (isNewIntent) {
            confirmMovementMethodChannel?.invokeMethod("showConfirmMovement", extras)
        } else {
            pendingConfirmMovementExtras = extras
        }
    }

    private fun requestPostNotificationsPermissionIfNeeded() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            val granted = checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) ==
                PackageManager.PERMISSION_GRANTED
            if (!granted) {
                requestPermissions(
                    arrayOf(Manifest.permission.POST_NOTIFICATIONS),
                    postNotificationsRequestCode
                )
            }
        }
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        EventChannel(flutterEngine.dartExecutor.binaryMessenger, notificationsChannel)
            .setStreamHandler(object : EventChannel.StreamHandler {
                override fun onListen(arguments: Any?, events: EventChannel.EventSink?) {
                    NotificationListener.eventSink = events
                }

                override fun onCancel(arguments: Any?) {
                    NotificationListener.eventSink = null
                }
            })

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, notificationSettingsChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "openNotificationListenerSettings" -> {
                        startActivity(Intent(Settings.ACTION_NOTIFICATION_LISTENER_SETTINGS))
                        result.success(null)
                    }
                    "isNotificationAccessGranted" -> {
                        result.success(isNotificationAccessGranted())
                    }
                    "postTestNotification" -> {
                        NotificationPoster.postTest(this)
                        result.success(null)
                    }
                    else -> result.notImplemented()
                }
            }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, backgroundSetupChannel)
            .setMethodCallHandler { call, result ->
                if (call.method == "registerCallbackHandle") {
                    val handle = (call.argument<Any>("handle") as? Number)?.toLong()
                    if (handle == null) {
                        result.error("INVALID_ARGS", "handle es requerido", null)
                    } else {
                        BackgroundCallbackPrefs.save(this, handle)
                        result.success(null)
                    }
                } else {
                    result.notImplemented()
                }
            }

        confirmMovementMethodChannel =
            MethodChannel(flutterEngine.dartExecutor.binaryMessenger, confirmMovementChannel)
        confirmMovementMethodChannel?.setMethodCallHandler { call, result ->
            if (call.method == "takePendingConfirmMovement") {
                val extras = pendingConfirmMovementExtras
                pendingConfirmMovementExtras = null
                result.success(extras)
            } else {
                result.notImplemented()
            }
        }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, dedupChannel)
            .setMethodCallHandler { call, result ->
                if (call.method == "checkAndRecord") {
                    val fingerprint = call.argument<String>("fingerprint") ?: ""
                    val windowMs = (call.argument<Any>("windowMs") as? Number)?.toLong()
                    result.success(
                        if (windowMs != null) {
                            DedupPrefs.checkAndRecord(this, fingerprint, windowMs)
                        } else {
                            DedupPrefs.checkAndRecord(this, fingerprint)
                        }
                    )
                } else {
                    result.notImplemented()
                }
            }

        MethodChannel(flutterEngine.dartExecutor.binaryMessenger, monitoredAppsChannel)
            .setMethodCallHandler { call, result ->
                when (call.method) {
                    "getMonitoredApps" -> {
                        result.success(MonitoredAppsPrefs.getAll(this).map { it.toMap() })
                    }
                    "getInstallableApps" -> {
                        result.success(MonitoredAppsPrefs.getInstallableApps(this).map { it.toMap() })
                    }
                    "setAppEnabled" -> {
                        val packageNameArg = call.argument<String>("packageName")
                        val enabledArg = call.argument<Boolean>("enabled")
                        if (packageNameArg == null || enabledArg == null) {
                            result.error(
                                "INVALID_ARGS",
                                "packageName y enabled son requeridos",
                                null
                            )
                        } else {
                            MonitoredAppsPrefs.setPackageEnabled(this, packageNameArg, enabledArg)
                            result.success(null)
                        }
                    }
                    "addMonitoredApp" -> {
                        val packageNameArg = call.argument<String>("packageName")
                        if (packageNameArg == null) {
                            result.error("INVALID_ARGS", "packageName es requerido", null)
                        } else {
                            result.success(
                                MonitoredAppsPrefs.addApp(this, packageNameArg).map { it.toMap() }
                            )
                        }
                    }
                    "removeMonitoredApp" -> {
                        val packageNameArg = call.argument<String>("packageName")
                        if (packageNameArg == null) {
                            result.error("INVALID_ARGS", "packageName es requerido", null)
                        } else {
                            result.success(
                                MonitoredAppsPrefs.removeApp(this, packageNameArg).map { it.toMap() }
                            )
                        }
                    }
                    else -> result.notImplemented()
                }
            }
    }

    private fun MonitoredAppEntry.toMap(): Map<String, Any> = mapOf(
        "packageName" to packageName,
        "displayName" to displayName,
        "enabled" to enabled,
        "isDevTool" to isDevTool
    )

    private fun isNotificationAccessGranted(): Boolean {
        val flat = Settings.Secure.getString(contentResolver, "enabled_notification_listeners")
        return flat != null && flat.contains(packageName)
    }
}
