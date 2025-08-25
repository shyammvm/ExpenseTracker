function getUIDsFromCreditArchive() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName("Current Credit Cycle");

  if (!sheet) {
    Logger.log("Credit-Archive sheet not found.");
    return [];

  }
  
  const lastRow = sheet.getLastRow();

  if (lastRow < 2) { // If we have only header or no rows
    Logger.log("Credit-Archive is empty.");
    return [];

  }
  
  // Assuming UID is in column 6 (G), starting from row 2
  const uids = sheet.getRange(2, 6, lastRow - 1, 1).getValues()
    .flat()
    .filter(String); // Filter out empty strings

  Logger.log("UIDs from Credit-Archive: " + uids);
  return uids;
}

function unarchiveNotionPages(notionToken, uids) {
  const headers = {
    "Authorization": `Bearer ${notionToken}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
  };
  
  uids.forEach(id => {
    try {
      UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${id}`,
        { method:'patch', headers: headers, payload: JSON.stringify({ "archived": false }) }
      );
      Logger.log(`Page ${id} has been unarchived.`);
    } catch (e) {
      Logger.log(`Error unarchiving page ${id}: ${e}`);
    }
  });

  Logger.log("All previously archived pages have been processed.");
}

function mainUnarchiveProcess() {
  const notionToken = getSecrets("notion_token");
  
  const uids = getUIDsFromCreditArchive();

  if (uids.length > 0) {
    unarchiveNotionPages(notionToken, uids);
  } else {
    Logger.log("No IDs to unarchive.");
  }
}