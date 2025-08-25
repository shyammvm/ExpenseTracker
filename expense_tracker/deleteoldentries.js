function deleteOldExpensesFromNotion() {
  const notionToken = getSecrets("notion_token");
  const expensesDbId = getSecrets("debit");
  const headers = {
    "Authorization": `Bearer ${notionToken}`,
    "Content-Type": "application/json",
    "Notion-Version": "2022-06-28"
  };

  const twoMonthsAgo = new Date();
  twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);

  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const payload = {
      page_size: 100
    };
    if (startCursor) {
      payload.start_cursor = startCursor;
    }

    const response = UrlFetchApp.fetch(`https://api.notion.com/v1/databases/${expensesDbId}/query`, {
      method: "post",
      headers: headers,
      payload: JSON.stringify(payload)
    });

    const data = JSON.parse(response.getContentText());
    const results = data.results;

    results.forEach(page => {
      const dateProp = page.properties?.Date?.date?.start;
      if (dateProp) {
        const entryDate = new Date(dateProp);
        if (entryDate < twoMonthsAgo) {
          // Archive the old page
          UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${page.id}`, {
            method: "patch",
            headers: headers,
            payload: JSON.stringify({ archived: true })
          });
        }
      }
    });

    hasMore = data.has_more;
    startCursor = data.next_cursor;
  }
}