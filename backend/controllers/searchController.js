const searchService = require('../services/searchService');
const asyncHandler = require('../utils/asyncHandler');
const { ApiResponse } = require('../utils/apiResponse');

const searchController = {
  globalSearch: asyncHandler(async (req, res) => {
    const result = await searchService.globalSearch(req.query, null);
    return ApiResponse.success(res, result);
  }),

  filterRestaurants: asyncHandler(async (req, res) => {
    const result = await searchService.filterRestaurants(req.query);
    return ApiResponse.paginated(res, result.restaurants, result.pagination);
  }),

  autocomplete: asyncHandler(async (req, res) => {
    const suggestions = await searchService.autocomplete(req.query.q);
    return ApiResponse.success(res, { suggestions });
  }),

  trending: asyncHandler(async (req, res) => {
    const trending = await searchService.getTrending();
    return ApiResponse.success(res, { trending });
  }),
};

module.exports = searchController;
