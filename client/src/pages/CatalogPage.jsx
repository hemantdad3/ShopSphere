import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { Search, SlidersHorizontal, Heart, ShoppingBag, X } from 'lucide-react';
import { productsApi, categoriesApi } from '../services/api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import RatingStars from '../components/RatingStars';

export default function CatalogPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { addToCart, loading: cartLoading } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters State from URL params
  const searchQuery = searchParams.get('search') || '';
  const selectedCategory = searchParams.get('category') || '';
  const selectedSort = searchParams.get('sort') || '';
  const minPrice = searchParams.get('minPrice') || '';
  const maxPrice = searchParams.get('maxPrice') || '';
  const inStockOnly = searchParams.get('inStock') === 'true';
  const currentPage = parseInt(searchParams.get('page') || '1', 10);

  // Load Categories on mount
  useEffect(() => {
    categoriesApi
      .getAll()
      .then((data) => setCategories(data.categories || []))
      .catch((err) => console.error('Failed to load categories:', err));
  }, []);

  // Fetch Products whenever filters change
  useEffect(() => {
    setLoading(true);
    setError(null);

    const params = {
      page: currentPage,
      limit: 12,
    };
    if (searchQuery) params.search = searchQuery;
    if (selectedCategory) params.category = selectedCategory;
    if (selectedSort) params.sort = selectedSort;
    if (minPrice) params.minPrice = minPrice;
    if (maxPrice) params.maxPrice = maxPrice;
    if (inStockOnly) params.inStock = 'true';

    productsApi
      .getAll(params)
      .then((data) => {
        setProducts(data.products || []);
        setPagination(data.pagination || { page: 1, totalPages: 1, total: 0 });
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [searchQuery, selectedCategory, selectedSort, minPrice, maxPrice, inStockOnly, currentPage]);

  const updateFilter = (key, value) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
    nextParams.set('page', '1'); // Reset to first page
    setSearchParams(nextParams);
  };

  const clearAllFilters = () => {
    setSearchParams({});
  };

  const handleWishlistToggle = async (e, productId) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      if (isInWishlist(productId)) {
        await removeFromWishlist(productId);
      } else {
        await addToWishlist(productId);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleAddToCart = async (e, productId) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await addToCart(productId, 1);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Catalog Header & Filter Bar */}
      <div className="border-b border-[#E5E7EB] pb-6 mb-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[#17202A] tracking-tight">
              Product Catalog
            </h1>
            <p className="text-xs text-[#667085] mt-1">
              Showing {pagination.total} verified products with live authoritative inventory
            </p>
          </div>

          {/* Controls: Search, Sort */}
          <div className="flex flex-wrap items-center gap-3">
            {/* Sort Dropdown */}
            <div className="flex items-center space-x-2">
              <span className="text-xs font-medium text-[#667085]">Sort:</span>
              <select
                value={selectedSort}
                onChange={(e) => updateFilter('sort', e.target.value)}
                className="text-xs font-semibold bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 text-[#17202A] focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
              >
                <option value="">Featured / Default</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Highest Rated</option>
              </select>
            </div>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center space-x-2 overflow-x-auto pt-5 pb-2">
          <button
            type="button"
            onClick={() => updateFilter('category', '')}
            className={`px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition cursor-pointer ${
              !selectedCategory
                ? 'bg-[#1F3A5F] text-white shadow-xs'
                : 'bg-white text-[#667085] border border-[#E5E7EB] hover:bg-gray-50'
            }`}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat._id}
              type="button"
              onClick={() => updateFilter('category', cat.slug)}
              className={`px-3.5 py-1.5 rounded-full text-xs font-medium shrink-0 transition cursor-pointer ${
                selectedCategory === cat.slug
                  ? 'bg-[#1F3A5F] text-white shadow-xs'
                  : 'bg-white text-[#667085] border border-[#E5E7EB] hover:bg-gray-50'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Active Filter Badges */}
        {(searchQuery || selectedCategory || minPrice || maxPrice || inStockOnly) && (
          <div className="flex flex-wrap items-center gap-2 mt-4 pt-4 border-t border-[#E5E7EB]/60">
            <span className="text-xs text-[#667085] font-medium">Active filters:</span>
            {searchQuery && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-gray-100 text-[#17202A]">
                Search: "{searchQuery}"
                <button type="button" onClick={() => updateFilter('search', '')} className="ml-1 text-gray-400 hover:text-black">
                  <X size={12} />
                </button>
              </span>
            )}
            {selectedCategory && (
              <span className="inline-flex items-center px-2.5 py-1 rounded-md text-xs bg-gray-100 text-[#17202A]">
                Category: {categories.find((c) => c.slug === selectedCategory)?.name || selectedCategory}
                <button type="button" onClick={() => updateFilter('category', '')} className="ml-1 text-gray-400 hover:text-black">
                  <X size={12} />
                </button>
              </span>
            )}
            <button
              type="button"
              onClick={clearAllFilters}
              className="text-xs text-[#1F3A5F] font-semibold hover:underline ml-2"
            >
              Clear All
            </button>
          </div>
        )}
      </div>

      {/* Main Grid & Loading States */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-4 animate-pulse space-y-3">
              <div className="w-full h-48 bg-gray-200 rounded-lg" />
              <div className="h-4 bg-gray-200 rounded w-3/4" />
              <div className="h-3 bg-gray-200 rounded w-1/2" />
              <div className="h-8 bg-gray-200 rounded mt-4" />
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-8 text-center max-w-md mx-auto my-12">
          <p className="text-sm font-semibold text-[#B54747]">{error}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-[#1F3A5F] text-white text-xs font-semibold rounded-lg"
          >
            Retry Connection
          </button>
        </div>
      ) : products.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-12 text-center max-w-md mx-auto my-12 shadow-xs">
          <div className="w-12 h-12 rounded-full bg-[#F7F7F5] flex items-center justify-center text-gray-400 mx-auto mb-3">
            <Search size={24} />
          </div>
          <h3 className="text-sm font-semibold text-[#17202A]">No products found</h3>
          <p className="text-xs text-[#667085] mt-1">
            Try adjusting your search query, price parameters, or category filters.
          </p>
          <button
            type="button"
            onClick={clearAllFilters}
            className="mt-4 px-4 py-2 bg-[#1F3A5F] text-white text-xs font-semibold rounded-lg hover:bg-[#172D4A] transition"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <>
          {/* Products Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
            {products.map((product) => {
              const inWishlist = isInWishlist(product._id);
              const isOutOfStock = product.stock <= 0;

              return (
                <div
                  key={product._id}
                  className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden hover:shadow-md transition-shadow flex flex-col justify-between group relative"
                >
                  {/* Top Badges & Wishlist Heart */}
                  <div className="relative">
                    {/* Thumbnail */}
                    <Link
                      to={`/products/${product.slug || product._id}`}
                      className="block aspect-square overflow-hidden bg-[#F7F7F5]"
                    >
                      {product.images && product.images.length > 0 ? (
                        <img
                          src={product.images[0].url}
                          alt={product.name}
                          className="w-full h-full object-cover group-hover:scale-103 transition duration-300"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-gray-300">
                          <ShoppingBag size={32} />
                        </div>
                      )}
                    </Link>

                    {/* Discount Badge */}
                    {product.discount > 0 && (
                      <span className="absolute top-2.5 left-2.5 bg-[#2F6B4F] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">
                        {product.discount}% OFF
                      </span>
                    )}

                    {/* Out of stock overlay badge */}
                    {isOutOfStock && (
                      <span className="absolute top-2.5 left-2.5 bg-[#B54747] text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-xs">
                        Out of Stock
                      </span>
                    )}

                    {/* Wishlist Button */}
                    <button
                      type="button"
                      onClick={(e) => handleWishlistToggle(e, product._id)}
                      className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center shadow-xs text-gray-600 hover:text-rose-600 transition cursor-pointer"
                      aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
                    >
                      <Heart
                        size={16}
                        className={inWishlist ? 'fill-rose-500 text-rose-500' : 'text-gray-500'}
                      />
                    </button>
                  </div>

                  {/* Card Content */}
                  <div className="p-4 flex-1 flex flex-col justify-between">
                    <div>
                      {/* Category Label */}
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-[#667085]">
                        {product.category?.name || 'General'}
                      </span>

                      {/* Title */}
                      <h3 className="text-xs font-semibold text-[#17202A] mt-1 line-clamp-2 hover:text-[#1F3A5F] transition">
                        <Link to={`/products/${product.slug || product._id}`}>
                          {product.name}
                        </Link>
                      </h3>

                      {/* Ratings */}
                      <div className="flex items-center space-x-1.5 mt-2">
                        <RatingStars rating={product.ratingAverage || 0} size={12} />
                        <span className="text-[11px] text-[#667085]">
                          ({product.reviewCount || 0})
                        </span>
                      </div>
                    </div>

                    {/* Price & Add to Cart */}
                    <div className="mt-4 pt-3 border-t border-[#E5E7EB]">
                      <div className="flex items-baseline justify-between mb-3">
                        <div>
                          <span className="text-sm font-bold text-[#17202A]">
                            ₹{product.finalPrice?.toLocaleString('en-IN')}
                          </span>
                          {product.discount > 0 && (
                            <span className="text-xs text-gray-400 line-through ml-1.5">
                              ₹{product.price?.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        {product.stock > 0 && product.stock <= 5 && (
                          <span className="text-[10px] font-medium text-amber-600">
                            Only {product.stock} left!
                          </span>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={(e) => handleAddToCart(e, product._id)}
                        disabled={isOutOfStock || cartLoading}
                        className="w-full py-2 px-3 rounded-lg bg-[#1F3A5F] text-white text-xs font-semibold flex items-center justify-center space-x-1.5 hover:bg-[#172D4A] transition disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer shadow-xs"
                      >
                        <ShoppingBag size={14} />
                        <span>{isOutOfStock ? 'Sold Out' : 'Add to Cart'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bounded Pagination Controls */}
          {pagination.totalPages > 1 && (
            <div className="mt-12 flex items-center justify-center space-x-2">
              <button
                type="button"
                onClick={() => updateFilter('page', (currentPage - 1).toString())}
                disabled={currentPage <= 1}
                className="px-3.5 py-2 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#17202A] disabled:opacity-40 hover:bg-gray-50 transition cursor-pointer"
              >
                Previous
              </button>

              <div className="flex items-center space-x-1">
                {[...Array(pagination.totalPages)].map((_, idx) => {
                  const pageNum = idx + 1;
                  return (
                    <button
                      key={pageNum}
                      type="button"
                      onClick={() => updateFilter('page', pageNum.toString())}
                      className={`w-8 h-8 rounded-lg text-xs font-semibold transition cursor-pointer ${
                        currentPage === pageNum
                          ? 'bg-[#1F3A5F] text-white'
                          : 'bg-white border border-[#E5E7EB] text-[#17202A] hover:bg-gray-50'
                      }`}
                    >
                      {pageNum}
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => updateFilter('page', (currentPage + 1).toString())}
                disabled={currentPage >= pagination.totalPages}
                className="px-3.5 py-2 rounded-lg border border-[#E5E7EB] bg-white text-xs font-medium text-[#17202A] disabled:opacity-40 hover:bg-gray-50 transition cursor-pointer"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
