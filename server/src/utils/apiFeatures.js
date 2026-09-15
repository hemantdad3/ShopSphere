/**
 * Reusable Query Builder utility for searching, filtering, sorting, and paginating Mongoose queries.
 */
class APIFeatures {
  /**
   * @param {mongoose.Query} query - Mongoose query object
   * @param {object} queryString - Express req.query object
   */
  constructor(query, queryString) {
    this.query = query;
    this.queryString = queryString;
    this.pagination = { page: 1, limit: 12, skip: 0 };
  }

  /**
   * Safe text search across name and description with ReDoS protection
   */
  search() {
    if (this.queryString.search && this.queryString.search.trim()) {
      // ReDoS Defense: Escape regex special characters to prevent catastrophic backtracking
      const escapedTerm = this.queryString.search
        .trim()
        .replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

      const searchRegex = new RegExp(escapedTerm, 'i');

      this.query = this.query.find({
        $or: [
          { name: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
        ],
      });
    }
    return this;
  }

  /**
   * Filter by Category, Price Range, and In-Stock status
   *
   * @param {object} extraFilter - Optional pre-resolved filters (e.g. category ObjectId)
   */
  filter(extraFilter = {}) {
    // 1. Apply pre-resolved filters (such as resolved Category ObjectId)
    if (extraFilter && Object.keys(extraFilter).length > 0) {
      this.query = this.query.find(extraFilter);
    }

    // 2. Price Range Filtering
    const priceConditions = {};
    if (this.queryString.minPrice !== undefined && this.queryString.minPrice !== '') {
      priceConditions.$gte = Number(this.queryString.minPrice);
    }
    if (this.queryString.maxPrice !== undefined && this.queryString.maxPrice !== '') {
      priceConditions.$lte = Number(this.queryString.maxPrice);
    }
    if (Object.keys(priceConditions).length > 0) {
      this.query = this.query.find({ price: priceConditions });
    }

    // 3. Stock Availability Filter
    if (this.queryString.inStock === 'true' || this.queryString.inStock === true) {
      this.query = this.query.find({ stock: { $gt: 0 } });
    }

    return this;
  }

  /**
   * Deterministic sorting with unique _id tie-breaker
   */
  sort() {
    const sortParam = this.queryString.sort;

    switch (sortParam) {
      case 'price-asc':
        this.query = this.query.sort({ price: 1, _id: 1 });
        break;
      case 'price-desc':
        this.query = this.query.sort({ price: -1, _id: 1 });
        break;
      case 'rating':
        this.query = this.query.sort({ ratingAverage: -1, reviewCount: -1, _id: 1 });
        break;
      case 'popularity':
        this.query = this.query.sort({ reviewCount: -1, ratingAverage: -1, _id: 1 });
        break;
      case 'newest':
      default:
        this.query = this.query.sort({ createdAt: -1, _id: 1 });
        break;
    }

    return this;
  }

  /**
   * Bounded pagination: strictly enforces limits between 1 and 50 to prevent DoS
   */
  paginate() {
    const page = Math.max(1, parseInt(this.queryString.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(this.queryString.limit, 10) || 12));
    const skip = (page - 1) * limit;

    this.pagination = { page, limit, skip };
    this.query = this.query.skip(skip).limit(limit);

    return this;
  }
}

module.exports = APIFeatures;
