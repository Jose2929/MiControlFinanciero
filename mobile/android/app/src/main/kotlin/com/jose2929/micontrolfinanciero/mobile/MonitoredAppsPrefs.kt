package com.jose2929.micontrolfinanciero.mobile

import android.content.Context
import android.content.pm.PackageManager
import org.json.JSONArray
import org.json.JSONObject

data class MonitoredAppEntry(
    val packageName: String,
    val displayName: String,
    val enabled: Boolean
)

// Fase 3: lista de apps monitoreadas, editable por el usuario (agregar
// cualquier app instalada, quitarla, activarla/desactivarla). Se persiste
// aqui (SharedPreferences nativo, como JSON) para que NotificationListener
// pueda filtrar aunque la app este cerrada o la UI de Flutter no este
// corriendo.
object MonitoredAppsPrefs {
    private const val PREFS_NAME = "mcf_monitored_apps"
    private const val KEY_APPS_JSON = "apps_json"

    // D6: paquetes reales confirmados por el usuario, usados solo para
    // sembrar la lista la primera vez que se abre la app.
    private val DEFAULT_SEED_PACKAGES = listOf(
        "mx.bancosantander.supermovil",
        "com.google.android.apps.walletnfcrel",
        "com.paypal.android.p2pmobile",
        "mx.hsbc.hsbcmexico"
    )

    fun getEnabledPackages(context: Context): Set<String> {
        return getAll(context).filter { it.enabled }.map { it.packageName }.toSet()
    }

    fun getAll(context: Context): List<MonitoredAppEntry> {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        val raw = prefs.getString(KEY_APPS_JSON, null)
            ?: return seedDefaults(context)
        return decode(raw)
    }

    fun addApp(context: Context, packageName: String): List<MonitoredAppEntry> {
        val current = getAll(context).toMutableList()
        if (current.none { it.packageName == packageName }) {
            val displayName = resolveDisplayName(context, packageName)
            current.add(
                MonitoredAppEntry(
                    packageName = packageName,
                    displayName = displayName,
                    enabled = true
                )
            )
            save(context, current)
        }
        return current
    }

    fun removeApp(context: Context, packageName: String): List<MonitoredAppEntry> {
        val current = getAll(context).filter { it.packageName != packageName }
        save(context, current)
        return current
    }

    fun setPackageEnabled(context: Context, packageName: String, enabled: Boolean) {
        val current = getAll(context).map {
            if (it.packageName == packageName) it.copy(enabled = enabled) else it
        }
        save(context, current)
    }

    // Apps instaladas con icono de lanzador (lo que normalmente veria el
    // usuario en su pantalla de inicio), excluyendo las ya monitoreadas.
    // Usado por la UI para dejar elegir que app agregar.
    fun getInstallableApps(context: Context): List<MonitoredAppEntry> {
        val pm = context.packageManager
        val alreadyMonitored = getAll(context).map { it.packageName }.toSet()
        val launcherIntent = android.content.Intent(android.content.Intent.ACTION_MAIN)
        launcherIntent.addCategory(android.content.Intent.CATEGORY_LAUNCHER)

        val resolveInfos = pm.queryIntentActivities(launcherIntent, 0)
        return resolveInfos
            .map { it.activityInfo.packageName }
            .distinct()
            .filter { it != context.packageName && it !in alreadyMonitored }
            .map { pkg -> MonitoredAppEntry(pkg, resolveDisplayName(context, pkg), false) }
            .sortedBy { it.displayName.lowercase() }
    }

    private fun resolveDisplayName(context: Context, packageName: String): String {
        return try {
            val appInfo = context.packageManager.getApplicationInfo(packageName, 0)
            context.packageManager.getApplicationLabel(appInfo).toString()
        } catch (e: PackageManager.NameNotFoundException) {
            packageName
        }
    }

    private fun seedDefaults(context: Context): List<MonitoredAppEntry> {
        val seeded = DEFAULT_SEED_PACKAGES.map { pkg ->
            MonitoredAppEntry(
                packageName = pkg,
                displayName = resolveDisplayName(context, pkg),
                enabled = true
            )
        }
        save(context, seeded)
        return seeded
    }

    private fun save(context: Context, apps: List<MonitoredAppEntry>) {
        val prefs = context.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        prefs.edit().putString(KEY_APPS_JSON, encode(apps)).apply()
    }

    private fun encode(apps: List<MonitoredAppEntry>): String {
        val array = JSONArray()
        for (app in apps) {
            val obj = JSONObject()
            obj.put("packageName", app.packageName)
            obj.put("displayName", app.displayName)
            obj.put("enabled", app.enabled)
            array.put(obj)
        }
        return array.toString()
    }

    private fun decode(raw: String): List<MonitoredAppEntry> {
        val array = JSONArray(raw)
        val result = mutableListOf<MonitoredAppEntry>()
        for (i in 0 until array.length()) {
            val obj = array.getJSONObject(i)
            result.add(
                MonitoredAppEntry(
                    packageName = obj.getString("packageName"),
                    displayName = obj.getString("displayName"),
                    enabled = obj.getBoolean("enabled")
                )
            )
        }
        return result
    }
}
