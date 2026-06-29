export const slsDialect = {
  jsonExtractScalar(field: string, path: string) {
    return `json_extract_scalar(${field}, '$.${path}')`
  }
}
