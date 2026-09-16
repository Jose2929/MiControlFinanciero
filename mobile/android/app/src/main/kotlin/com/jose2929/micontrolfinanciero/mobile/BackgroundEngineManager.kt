package com.jose2929.micontrolfinanciero.mobile

import android.content.Context
import android.os.Handler
import android.os.Looper
import android.util.Log
import io.flutter.FlutterInjector
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.embedding.engine.dart.DartExecutor
import io.flutter.plugin.common.MethodChannel
import io.flutter.view.FlutterCallbackInformation

// Fase 7: arranca un FlutterEngine "headless" (sin Activity) bajo demanda
// para procesar una notificacion capturada, incluso si la app esta
// totalmente cerrada. Un engine nuevo por evento; se destruye al terminar
// (con un timeout de seguridad por si el lado Dart nunca responde).
object BackgroundEngineManager {
    private const val TAG = "MCF_BackgroundEngine"
    private const val PROCESSOR_CHANNEL = "mcf/background_processor"
    private const val DEDUP_CHANNEL = "mcf/dedup"
    private const val ENGINE_TIMEOUT_MS = 15_000L

    fun dispatch(
        context: Context,
        event: Map<String, Any?>,
        onResult: ((String) -> Unit)? = null
    ) {
        val handle = BackgroundCallbackPrefs.get(context)
        if (handle == null) {
            Log.w(TAG, "No hay callback handle registrado todavia; se ignora el evento")
            return
        }

        val loader = FlutterInjector.instance().flutterLoader()
        if (!loader.initialized()) {
            loader.startInitialization(context)
        }
        loader.ensureInitializationComplete(context, null)

        val callbackInfo = FlutterCallbackInformation.lookupCallbackInformation(handle)
        if (callbackInfo == null) {
            Log.w(TAG, "Callback handle invalido; se ignora el evento")
            return
        }

        val engine = FlutterEngine(context)
        val mainHandler = Handler(Looper.getMainLooper())
        var destroyed = false

        fun destroyOnce() {
            if (destroyed) return
            destroyed = true
            mainHandler.post { engine.destroy() }
        }

        mainHandler.postDelayed({ destroyOnce() }, ENGINE_TIMEOUT_MS)

        MethodChannel(engine.dartExecutor.binaryMessenger, DEDUP_CHANNEL)
            .setMethodCallHandler { call, result ->
                if (call.method == "checkAndRecord") {
                    val fingerprint = call.argument<String>("fingerprint") ?: ""
                    result.success(DedupPrefs.checkAndRecord(context, fingerprint))
                } else {
                    result.notImplemented()
                }
            }

        val processorChannel =
            MethodChannel(engine.dartExecutor.binaryMessenger, PROCESSOR_CHANNEL)
        processorChannel.setMethodCallHandler { call, result ->
            when (call.method) {
                "backgroundEngineReady" -> {
                    result.success(null)
                    processorChannel.invokeMethod("processNotification", event)
                }
                "postOwnNotification" -> {
                    val title = call.argument<String>("title") ?: "Movimiento detectado"
                    val text = call.argument<String>("text") ?: ""
                    val pkg = call.argument<String>("packageName") ?: ""
                    val amount = (call.argument<Any>("amount") as? Number)?.toDouble() ?: 0.0
                    val note = call.argument<String>("note")
                    val timestamp = (call.argument<Any>("timestamp") as? Number)?.toLong()
                        ?: System.currentTimeMillis()
                    val type = call.argument<String>("type") ?: "unknown"
                    NotificationPoster.postDetectedMovement(
                        context, title, text, pkg, amount, note, timestamp, type
                    )
                    result.success(null)
                }
                // Fase 15.2: el entrypoint Dart reporta el resultado de un
                // movimiento por voz (exito o error, en texto para mostrar
                // al usuario) antes de "done" -- VoiceMessageListener lo usa
                // para contestarle al reloj.
                "reportResult" -> {
                    val message = call.argument<String>("message") ?: ""
                    onResult?.invoke(message)
                    result.success(null)
                }
                "done" -> {
                    result.success(null)
                    destroyOnce()
                }
                else -> result.notImplemented()
            }
        }

        val dartCallback = DartExecutor.DartCallback(
            context.assets,
            loader.findAppBundlePath(),
            callbackInfo
        )
        engine.dartExecutor.executeDartCallback(dartCallback)
    }
}
