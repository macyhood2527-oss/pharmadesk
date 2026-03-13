import api from './api.js';

export const fetchAllPages = async (path, {
  dataKey,
  params = {},
  pageSize = 100
}) => {
  const results = [];
  let page = 1;
  let totalPages = 1;

  while (page <= totalPages) {
    const response = await api.get(path, {
      params: {
        ...params,
        page,
        limit: pageSize
      }
    });

    const payload = response.data?.[dataKey];
    if (!Array.isArray(payload)) {
      throw new Error(`Expected array data at response key "${dataKey}"`);
    }

    results.push(...payload);
    totalPages = Math.max(Number(response.data?.pagination?.pages || 1), 1);
    page += 1;
  }

  return results;
};
