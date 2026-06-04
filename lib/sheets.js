const API = 'https://sheets.googleapis.com/v4/spreadsheets';

let CURRENT_SHEET_ID = null;
async function call(token, path, options = {}) {
  let url;
  if (path.startsWith('?') && CURRENT_SHEET_ID) {
    url = `${API}/${CURRENT_SHEET_ID}${path}`;
  } else {
    url = `${API}${path}`;
    const m = path.match(/^\/([^/?:]+)/);
    if (m) CURRENT_SHEET_ID = m[1];
  }
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Sheets API ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

export async function createSpreadsheet(token, title = 'LeetCode Enforcer') {
  const res = await call(token, '', {
    method: 'POST',
    body: JSON.stringify({
      properties: { title },
      sheets: [
        { properties: { sheetId: 0, title: 'Problems', gridProperties: { frozenRowCount: 1 } } },
        { properties: { sheetId: 1, title: 'Stats' } }
      ]
    })
  });
  await applyTemplate(token, res.spreadsheetId);
  return { spreadsheetId: res.spreadsheetId, spreadsheetUrl: res.spreadsheetUrl };
}

export async function applyTemplate(token, sheetId) {
  const headers = ['#', 'Title', 'URL', 'Difficulty', 'Topics',
    'First solved', 'Last reviewed', 'Times reviewed', 'SRS interval (days)',
    'Next due', 'Status', 'Latest confidence', 'Notes'];

  await call(token, `/${sheetId}/values/Problems!A1:M1?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: [headers] })
  });

  const statsHeaders = [['LeetCode Enforcer — Stats']];
  await call(token, `/${sheetId}/values/Stats!A1:D1?valueInputOption=RAW`, {
    method: 'PUT',
    body: JSON.stringify({ values: statsHeaders })
  });

  await applyStyles(token, sheetId);
}

export async function applyStyles(token, sheetId) {
  const existing = await call(token, `?fields=sheets(properties(sheetId),bandedRanges(bandedRangeId))`);
  const sheets = existing.sheets || [];
  const dropRequests = [];
  for (const s of sheets) {
    for (const b of (s.bandedRanges || [])) {
      dropRequests.push({ deleteBanding: { bandedRangeId: b.bandedRangeId } });
    }
  }
  await call(token, `/${sheetId}:batchUpdate`, {
    method: 'POST',
    body: JSON.stringify({
      requests: [
        ...dropRequests,
        ...notionStyleRequests(0, 13),
        ...notionStyleRequests(1, 8),
        ...difficultyConditionalFormat(0),
        ...statsLayoutRequests(1)
      ]
    })
  });
}

function notionStyleRequests(sheetId, numCols) {
  const BLACK = { red: 0, green: 0, blue: 0 };
  return [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: numCols },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.941, green: 0.933, blue: 0.910 },
            textFormat: { foregroundColor: BLACK, bold: true, fontSize: 11 },
            horizontalAlignment: 'LEFT', verticalAlignment: 'MIDDLE',
            padding: { top: 6, bottom: 6, left: 8, right: 8 }
          }
        },
        fields: 'userEnteredFormat(backgroundColor,textFormat,horizontalAlignment,verticalAlignment,padding)'
      }
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: numCols },
        cell: { userEnteredFormat: { textFormat: { foregroundColor: BLACK } } },
        fields: 'userEnteredFormat.textFormat.foregroundColor'
      }
    },
    {
      addBanding: {
        bandedRange: {
          range: { sheetId, startRowIndex: 0, startColumnIndex: 0, endColumnIndex: numCols },
          rowProperties: {
            headerColor: { red: 0.941, green: 0.933, blue: 0.910 },
            firstBandColor: { red: 1, green: 1, blue: 1 },
            secondBandColor: { red: 0.969, green: 0.965, blue: 0.953 }
          }
        }
      }
    },
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: 'gridProperties.frozenRowCount'
      }
    }
  ];
}

function difficultyConditionalFormat(sheetId) {
  const mkRule = (value, color) => ({
    addConditionalFormatRule: {
      rule: {
        ranges: [{ sheetId, startRowIndex: 1, startColumnIndex: 3, endColumnIndex: 4 }],
        booleanRule: {
          condition: { type: 'TEXT_CONTAINS', values: [{ userEnteredValue: value }] },
          format: { backgroundColor: color, textFormat: { bold: true } }
        }
      },
      index: 0
    }
  });
  return [
    mkRule('Easy', { red: 0.86, green: 0.95, blue: 0.86 }),
    mkRule('Medium', { red: 1.0, green: 0.92, blue: 0.71 }),
    mkRule('Hard', { red: 0.98, green: 0.82, blue: 0.82 })
  ];
}

function statsLayoutRequests(sheetId) {
  return [
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 8 },
        cell: { userEnteredFormat: { textFormat: { foregroundColor: { red: 0, green: 0, blue: 0 }, bold: true, fontSize: 16 } } },
        fields: 'userEnteredFormat.textFormat'
      }
    }
  ];
}

export async function upsertProblemRow(token, sheetId, problem) {
  const rows = await readProblemSlugs(token, sheetId);
  const rowIndex = rows.indexOf(problem.url) + 2;
  const row = problemToRow(problem);
  const range = rowIndex >= 2
    ? `Problems!A${rowIndex}:M${rowIndex}`
    : 'Problems!A:M';

  if (rowIndex >= 2) {
    await call(token, `/${sheetId}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [row] })
    });
  } else {
    await call(token, `/${sheetId}/values/${encodeURIComponent('Problems!A:M')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
      method: 'POST',
      body: JSON.stringify({ values: [row] })
    });
  }
}

export async function bulkUpsertProblems(token, sheetId, problems) {
  if (problems.length === 0) return;
  const rows = problems.map(problemToRow);
  await call(token, `/${sheetId}/values/${encodeURIComponent('Problems!A:M')}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`, {
    method: 'POST',
    body: JSON.stringify({ values: rows })
  });
}

async function readProblemSlugs(token, sheetId) {
  try {
    const data = await call(token, `/${sheetId}/values/${encodeURIComponent('Problems!C2:C')}`);
    return (data.values || []).map(r => r[0]);
  } catch {
    return [];
  }
}

function problemToRow(p) {
  const statusEmoji = {
    Active: '🟢 Active',
    Mastered: '⭐ Mastered',
    Archived: '📦 Archived'
  }[p.status] || p.status;
  return [
    p.number,
    p.title,
    p.url,
    p.difficulty,
    (p.topics || []).join(', '),
    p.firstSolved,
    p.lastReviewed,
    p.timesReviewed,
    p.srsIntervalDays,
    p.lastReviewed
      ? new Date(new Date(p.lastReviewed).getTime() + p.srsIntervalDays * 86400000).toISOString().slice(0, 10)
      : '',
    statusEmoji,
    p.latestConfidence ?? '',
    p.notes ?? ''
  ];
}

export async function writeStatsData(token, sheetId, stats) {
  const { kpis, perDay, difficulty, confidence } = stats;
  await call(token, `/${sheetId}/values/${encodeURIComponent('Stats!A3:D4')}?valueInputOption=USER_ENTERED`, {
    method: 'PUT',
    body: JSON.stringify({
      values: [
        ['Streak', 'This week', 'Active', 'Mastered'],
        [kpis.streak, kpis.thisWeek, kpis.totalActive, kpis.totalMastered]
      ]
    })
  });
  if (perDay.length) {
    await call(token, `/${sheetId}/values/${encodeURIComponent('Stats!A7:B' + (7 + perDay.length))}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [['Date', 'Solves'], ...perDay] })
    });
  }
  if (difficulty.length) {
    await call(token, `/${sheetId}/values/${encodeURIComponent('Stats!D7:E' + (7 + difficulty.length))}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [['Difficulty', 'Count'], ...difficulty] })
    });
  }
  if (confidence.length) {
    await call(token, `/${sheetId}/values/${encodeURIComponent('Stats!G7:H' + (7 + confidence.length))}?valueInputOption=USER_ENTERED`, {
      method: 'PUT',
      body: JSON.stringify({ values: [['Week', 'Avg confidence'], ...confidence] })
    });
  }
}
