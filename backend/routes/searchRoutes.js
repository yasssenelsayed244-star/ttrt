const express = require('express');
const router = express.Router();
const ctrl = require('../controllers/searchController');

router.get('/',            ctrl.globalSearch);
router.get('/filter',      ctrl.filterRestaurants);
router.get('/autocomplete',ctrl.autocomplete);
router.get('/trending',    ctrl.trending);

module.exports = router;
