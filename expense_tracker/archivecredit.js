function main_archive() {
  const NOTION_TOKEN_ = getSecrets("notion_token");
  const NOTION_DB_ID_ = getSecrets("credit");
  const day = today.getDate();
  Logger.log(day)
  if (day === 16) {
    archiveCreditData();
    clearNotionDatabase(NOTION_TOKEN_, NOTION_DB_ID_);
    }
}

function archiveCreditData() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const currentSheet = ss.getSheetByName("Current Credit Cycle");

  if (!currentSheet) {
    Logger.log("Current Credit Cycle sheet not found.");
    return;
  }
  
  const archiveSheet = ss.getSheetByName("Credit-Archive") || ss.insertSheet("Credit-Archive");

  const lastRow = archiveSheet.getLastRow();

  // If it's a new sheet, add headers
  if (lastRow <= 1) {
    archiveSheet.clear();
    archiveSheet.appendRow(["Name", "Amount", "Category", "Date", "Notes", "UID", "Cycle Month"]);
  }

  // Get all existing UIDs in archive
  let existingUIDs = [];
  if (archiveSheet.getLastRow() > 1) {
    existingUIDs = archiveSheet
      .getRange(2, 6, archiveSheet.getLastRow() - 1, 1)
      .getValues()
      .flat()
      .filter(String);
  }

  existingUIDs = new Set(existingUIDs);

  // Get current sheet values
  const currentValues = currentSheet.getDataRange().getValues();
  const headers = currentValues[0];

  const nameIdx = headers.indexOf("Name");
  const amountIdx = headers.indexOf("Amount");
  const categoryIdx = headers.indexOf("Category");
  const dateIdx = headers.indexOf("Date");
  const notesIdx = headers.indexOf("Notes");
  const uidIdx = headers.indexOf("UID");

  for (let i = 1; i < currentValues.length; i++) {
    const row = currentValues[i];
    const uid = row[uidIdx];

    if (uid && !existingUIDs.has(uid)) {
      const dateStr = row[dateIdx];
      const date = new Date(dateStr);

      const cycleMonth = getCreditCycleMonth(date);

      archiveSheet.appendRow([
        row[nameIdx],
        row[amountIdx],
        row[categoryIdx],
        dateStr,
        row[notesIdx],
        uid,
        cycleMonth
      ]);

      existingUIDs.add(uid);
    }
  }

  // Clear current sheet data below header
  const currLastRow = currentSheet.getLastRow();
  if (currLastRow > 1) {
    currentSheet.getRange(2, 1, currLastRow - 1, currentSheet.getLastColumn()).clear();
  }

  // Add fallback row
  currentSheet.appendRow([
    'N.A.', 0, 'N.A.',
    Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"),
    'N.A.', 'N.A.'
  ]);
}

// 🔧 Helper function to get credit cycle month
function getCreditCycleMonth(date) {
  const day = date.getDate();
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-based

  // If on or after 16th, cycle is next month
  let cycleDate;
  if (day >= 16) {
    cycleDate = new Date(year, month + 1, 1); // first day of next month
  } else {
    cycleDate = new Date(year, month, 1); // this month
  }

  return Utilities.formatDate(cycleDate, Session.getScriptTimeZone(), "MMMM yyyy");
}

function clearNotionDatabase(notionToken, databaseId) {
  const url = `https://api.notion.com/v1/databases/${databaseId}/query`;
  const headers = {
    "Authorization": `Bearer ${notionToken}`,
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
  };
  
  // 1. Query all pages in the database first
  let allPageIds = [];

  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const payload = { page_size: 100 };
    if (startCursor) payload.start_cursor = startCursor;

    const response = UrlFetchApp.fetch(url, { method:'post', headers: headers, payload: JSON.stringify(payload) });
    const data = JSON.parse(response.getContentText());

    allPageIds.push(...data.results.map(page => page.id));

    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }
  
  // Logger.log('Page IDs to archive: ' + allPageIds.length);

  // 2. Now archive all those pages
  allPageIds.forEach(id => {
    try {
      const patchResponse = UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${id}`,
        { method:'patch', headers: headers, payload: JSON.stringify({ "archived": true }) }
      );
      // Logger.log(`Page ${id} updated. Response: ${patchResponse.getContentText()}`);

    } catch (e) {
      // Logger.log(`Error archiving page ${id}: ${e}`);
    }
  });

  Logger.log("All pages in database have been processed.");
}