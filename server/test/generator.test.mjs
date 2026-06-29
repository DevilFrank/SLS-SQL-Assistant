import assert from 'node:assert/strict'
import { generateSql } from '../dist/modules/sql-generator/index.js'

const cases = [
  {
    name: '用例 1：按 type 和 trackType 分组',
    input: '查询 su 是 https://www.fpffz.top/?channel=news01 的数据，按 type 和 trackType 分组显示',
    sql: `*
| SELECT
    count(*) AS cnt,
    (type, trackType) AS cc
FROM log
WHERE su LIKE '%https://www.fpffz.top/?channel=news01%'
GROUP BY cc
ORDER BY cnt DESC`
  },
  {
    name: '用例 2：带过滤条件按 path 分组',
    input: '查询 su 是 https://www.fpffz.top/?channel=news01，step 是 2，type = 6，trackType = 1 的数据，根据 path 分组',
    sql: `*
| SELECT
    path,
    count(*) AS cnt
FROM log
WHERE su LIKE '%https://www.fpffz.top/?channel=news01%'
  AND step = 2
  AND type = 6
  AND trackType = 1
GROUP BY path
ORDER BY cnt DESC`
  },
  {
    name: '用例 3：有 6-1 无 7-1',
    input: '查询 su 是 https://www.fpffz.top/?channel=news01，有 6-1 但是没有 7-1 的 trackId',
    sql: `*
| SELECT
    trackId,
    count(*) AS total_count
FROM log
WHERE su LIKE '%https://www.fpffz.top/?channel=news01%'
GROUP BY trackId
HAVING
    SUM(CASE WHEN type = 6 AND trackType = 1 THEN 1 ELSE 0 END) > 0
    AND
    SUM(CASE WHEN type = 7 AND trackType = 1 THEN 1 ELSE 0 END) = 0
ORDER BY total_count DESC
LIMIT 100000`
  },
  {
    name: '用例 4：有 6-1 无 7-1 并返回事件字段',
    input: '查询 su 是 https://www.fpffz.top/?channel=news01，有 6-1 没有 7-1，返回 6-1 的 actionValue、11-5 的 data、11-10 的 data',
    sql: `*
| SELECT
    trackId,
    arbitrary(
      CASE
        WHEN type = 6 AND trackType = 1 THEN actionValue
        ELSE NULL
      END
    ) AS actionValue,
    arbitrary(
      CASE
        WHEN type = 11 AND trackType = 5 THEN data
        ELSE NULL
      END
    ) AS data_11_5,
    arbitrary(
      CASE
        WHEN type = 11 AND trackType = 10 THEN data
        ELSE NULL
      END
    ) AS data_11_10
FROM log
WHERE su LIKE '%https://www.fpffz.top/?channel=news01%'
GROUP BY trackId
HAVING
    SUM(CASE WHEN type = 6 AND trackType = 1 THEN 1 ELSE 0 END) > 0
    AND
    SUM(CASE WHEN type = 7 AND trackType = 1 THEN 1 ELSE 0 END) = 0
LIMIT 100000`
  },
  {
    name: '用例 5：按 data.reason 分组',
    input: '查询 su 是 https://www.fpffz.top/?channel=news01，按 data 中 reason 字段分组',
    sql: `*
| SELECT
    json_extract_scalar(data, '$.reason') AS reason,
    count(*) AS cnt
FROM log
WHERE su LIKE '%https://www.fpffz.top/?channel=news01%'
GROUP BY json_extract_scalar(data, '$.reason')
ORDER BY cnt DESC`
  }
]

for (const testCase of cases) {
  const result = await generateSql(testCase.input)
  assert.equal(result.success, true, testCase.name)

  if (!result.success) {
    throw new Error(result.message)
  }

  assert.equal(result.data.sql, testCase.sql, testCase.name)
}

console.log(`Passed ${cases.length} SQL generator acceptance cases.`)
