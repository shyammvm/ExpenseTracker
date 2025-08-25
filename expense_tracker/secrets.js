function getSecrets(key) {
  const value = PropertiesService.getScriptProperties().getProperty(key);
  if (value) {
    Logger.log(`✅ Secret retrieved for key: ${key}`);
  } else {
    Logger.log(`⚠️ No secret found for key: ${key}`);
  }
  return value;
}
