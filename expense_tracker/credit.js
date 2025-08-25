// ---------- CONFIG SECTION ----------
const NOTION_TOKEN = getSecrets("notion_token");
const NOTION_DB_ID = getSecrets("credit");
// ------------------------------------

function importAndProcessCreditData() {

  // Step 1: Import data from Notion
  const notionData = fetchNotionCreditData();

  // Step 2: Update Current Credit Cycle sheet
  updateCurrentCreditSheet(notionData);
}

function fetchNotionCreditData() {
  const url = `https://api.notion.com/v1/databases/${NOTION_DB_ID}/query`;
  const headers = {
    "Authorization": `Bearer ${NOTION_TOKEN}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
  };

  let allPages = [];
  let hasMore = true;
  let startCursor = null;

  while (hasMore) {
    const payload = {
      page_size: 100,
      ...(startCursor && { start_cursor: startCursor })
    };

    const response = UrlFetchApp.fetch(url, {
      method: "post",
      headers: headers,
      payload: JSON.stringify(payload)
    });

    const data = JSON.parse(response.getContentText());
    allPages.push(...data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  return allPages.map(page => {
    const props = page.properties;
    return {
      id: page.id,
      name: props.Name?.title?.[0]?.plain_text || "",
      amount: props.Amount?.number || "",
      category: props.Category?.select?.name || "",
      date: props.Date?.date?.start || "",
      notes: props.Notes?.rich_text?.[0]?.plain_text || "",
      uid: page.id
    };
  });
}

function updateCurrentCreditSheet(data) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName("Current Credit Cycle");

  if (!sheet) {
    sheet = ss.insertSheet("Current Credit Cycle");
    sheet.appendRow(["Name", "Amount", "Category", "Date", "Notes", "Week Number", "Week Type", "UID"]);
  } else if (sheet.getLastRow() > 1) {
    sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clear();
  }

  if (data.length === 0) {
    sheet.appendRow(['N.A.', 0, 'N.A.', Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyy-MM-dd"), 'N.A.', 'N.A.', 'N.A.']);
    Logger.log("No new data to insert.");
    return;
  }

  // Sort by date first
  data.sort((a, b) => new Date(a.date) - new Date(b.date));

  data.forEach(row => {
    const date = new Date(row.date);
    const year = date.getFullYear();
    const month = date.getMonth(); // zero-based
    const dateNum = date.getDate();

    const weekendGroups = getWeekendGroupsForMonth(year, month);
    const weekNum = getWeekNumber(dateNum);
    const weekLabel = getWeekLabel(date, weekendGroups);

    sheet.appendRow([
      row.name,
      row.amount,
      row.category,
      row.date,
      row.notes,
      weekNum,
      weekLabel,
      row.uid
    ]);
  });

  Logger.log("Current Credit Cycle sheet updated with Week Numbers and Week Types.");
}

// Helper: get week number for any date in the month (same as master sheet logic)
function getWeekNumber(dateNum) {
  return Math.ceil(dateNum / 7);
}

// Helper: get weekend groups for a month (same as master sheet logic)
function getWeekendGroupsForMonth(year, month) {
  const weekendDates = [];
  const lastDay = new Date(year, month + 1, 0).getDate();
  
  for (let d = 1; d <= lastDay; d++) {
    const dt = new Date(year, month, d);
    const dayOfWeek = dt.getDay();
    if (dayOfWeek === 6 || dayOfWeek === 0) { // Saturday=6, Sunday=0
      weekendDates.push(d);
    }
  }
  
  // Create groups of weekend dates (group consecutive Sat-Sun pairs)
  const groups = {};
  let groupNum = 1;
  
  for (let i = 0; i < weekendDates.length; i++) {
    const date = weekendDates[i];
    const dt = new Date(year, month, date);
    const dayOfWeek = dt.getDay();
    
    if (dayOfWeek === 6) { // Saturday - start new group
      groups[date] = groupNum;
      // Check if next day is Sunday and in our weekend dates
      if (i + 1 < weekendDates.length && weekendDates[i + 1] === date + 1) {
        groups[weekendDates[i + 1]] = groupNum;
        i++; // Skip the Sunday since we've already processed it
      }
      groupNum++;
    } else if (dayOfWeek === 0) { // Sunday without preceding Saturday
      groups[date] = groupNum;
      groupNum++;
    }
  }
  
  return groups;
}

// Helper: get week label (same logic as master sheet)
function getWeekLabel(date, weekendGroups) {
  const dayOfWeek = date.getDay();
  const dateNum = date.getDate();
  
  if (dayOfWeek === 0 || dayOfWeek === 6) { // Weekend
    const weekendGroupNum = weekendGroups[dateNum] || 1;
    return `WK${weekendGroupNum}`;
  } else { // Weekday
    const weekNum = getWeekNumber(dateNum);
    return `W${weekNum}`;
  }
}

// function archiveCreditData(data) {
//   const archiveSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Credit-Archive") ||
//                        SpreadsheetApp.getActiveSpreadsheet().insertSheet("Credit-Archive");

//   const monthName = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "MMMM yyyy");

//   if (archiveSheet.getLastRow() === 0) {
//     archiveSheet.appendRow(["Name", "Amount", "Category", "Date", "Notes", "Month", "UID"]);
//   }

//   data.forEach(row => {
//     archiveSheet.appendRow([row.name, row.amount, row.category, row.date, row.notes, monthName, row.uid]);
//   });
// }

// function clearNotionDatabase(pageIds) {
//   const deleteUrl = "https://api.notion.com/v1/pages/";
//   const headers = {
//     "Authorization": `Bearer ${NOTION_TOKEN}`,
//     "Content-Type": "application/json",
//     "Notion-Version": "2022-06-28"
//   };

//   for (const id of pageIds) {
//     UrlFetchApp.fetch(deleteUrl + id, {
//       method: "patch",
//       headers: headers,
//       payload: JSON.stringify({ archived: true })
//     });
//   }
// }