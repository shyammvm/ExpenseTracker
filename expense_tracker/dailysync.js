function importNotionCleanByMonth() {
  const currentHour = new Date().getHours(); // Returns hour in 0–23 format (local script timezone)
  if (currentHour >= 0 && currentHour < 8) {
    Logger.log("Script stopped: Not allowed to run between 12 AM and 8 AM.");
    return;
  }

  const notionToken = getSecrets("notion_token");
  const databaseId = getSecrets("debit");
  const notionUrl = `https://api.notion.com/v1/databases/${databaseId}/query`;
  
  const headers = {
    "Authorization": `Bearer ${notionToken}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
  };

  let allPages = [];
  let hasMore = true;
  let startCursor = null;

  // Fetch all pages using pagination
  while (hasMore) {
    const payload = {
      page_size: 100,
      ...(startCursor && { start_cursor: startCursor })
    };

    const response = UrlFetchApp.fetch(notionUrl, {
      method: "post",
      headers: headers,
      payload: JSON.stringify(payload)
    });

    const data = JSON.parse(response.getContentText());
    allPages.push(...data.results);
    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }

  // Group data by month
  const grouped = {};

  allPages.forEach(page => {
    const props = page.properties;
    const dateStr = props.Date?.date?.start;
    if (!dateStr) return;

    const date = new Date(dateStr);
    const monthKey = formatDateToMonthSheet(dateStr); // e.g. "June 2025"

    // Initialize month group if not exists
    if (!grouped[monthKey]) {
      grouped[monthKey] = {
        data: [],
        year: date.getFullYear(),
        month: date.getMonth() // 0-based month
      };
    }

    grouped[monthKey].data.push({
      name: props.Name?.title?.[0]?.plain_text || "",
      amount: props.Amount?.number || "",
      category: props.Category?.select?.name || "",
      date: dateStr,
      notes: props.Notes?.rich_text?.[0]?.plain_text || "",
      dateObj: date,
      uid: page.id
    });
  });

  const ss = SpreadsheetApp.getActiveSpreadsheet();

  for (const month in grouped) {
    const monthData = grouped[month];
    
    // Get weekend groups for this month
    const weekendGroups = getWeekendGroupsForMonth(monthData.year, monthData.month);
    
    // Process each row with correct week logic
    const processedData = monthData.data.map(row => {
      const weekNum = getWeekNumber(row.dateObj.getDate());
      const weekLabel = getWeekLabel(row.dateObj, weekendGroups);
      
      return [
        row.name,
        row.amount,
        row.category,
        row.date,
        row.notes,
        weekNum,
        weekLabel,
        row.uid
      ];
    });

    let sheet = ss.getSheetByName(month);

    if (sheet) {
      sheet.clear();
    } else {
      sheet = ss.insertSheet(month);
    }

    // Add headers
    sheet.appendRow(["Name", "Amount", "Category", "Date", "Notes", "Week Number", "Week Type", "UID"]);

    // Sort data by date (index 3 = date string)
    processedData.sort((a, b) => new Date(a[3]) - new Date(b[3]));

    // Write all rows at once starting from row 2
    if (processedData.length > 0) {
      const dataRange = sheet.getRange(2, 1, processedData.length, processedData[0].length);
      dataRange.setValues(processedData);
    }
  }
  importAndProcessCreditData();
  generateDailySpend3D();
  
}

function formatDateToMonthSheet(dateStr) {
  const date = new Date(dateStr);
  const options = { month: 'long', year: 'numeric' };
  return date.toLocaleDateString('en-US', options); // "June 2025"
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