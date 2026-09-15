class MonitoredApp {
  final String packageName;
  final String displayName;
  final bool enabled;
  final bool isDevTool;

  const MonitoredApp({
    required this.packageName,
    required this.displayName,
    required this.enabled,
    required this.isDevTool,
  });

  MonitoredApp copyWith({bool? enabled}) {
    return MonitoredApp(
      packageName: packageName,
      displayName: displayName,
      enabled: enabled ?? this.enabled,
      isDevTool: isDevTool,
    );
  }
}
