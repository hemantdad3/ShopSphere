import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ShoppingBag, Heart, ShieldCheck, Check, AlertCircle, Plus, Minus, Trash2 } from 'lucide-react';
import { productsApi, reviewsApi } from '../services/api';
import { useCart } from '../context/CartContext';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import RatingStars from '../components/RatingStars';
import Modal from '../components/Modal';

export default function ProductDetailPage() {
  const { idOrSlug } = useParams();
  const { user, isAuthenticated, isAdmin } = useAuth();
  const { addToCart, loading: cartLoading } = useCart();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();

  const [product, setProduct] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Review Modal State
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState('');
  const [reviewComment, setReviewComment] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState(null);
  const [reviewSuccess, setReviewSuccess] = useState(false);

  useEffect(() => {
    setLoading(true);
    setError(null);

    productsApi
      .getBySlugOrId(idOrSlug)
      .then((data) => {
        setProduct(data.product);
        setSelectedImageIndex(0);
        return reviewsApi.getProductReviews(data.product._id);
      })
      .then((reviewData) => {
        setReviews(reviewData.reviews || []);
        setLoading(false);
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
  }, [idOrSlug]);

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 animate-pulse space-y-8">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="h-96 bg-gray-200 rounded-2xl" />
          <div className="space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4" />
            <div className="h-8 bg-gray-200 rounded w-3/4" />
            <div className="h-6 bg-gray-200 rounded w-1/3" />
            <div className="h-24 bg-gray-200 rounded mt-6" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="max-w-md mx-auto my-20 p-8 bg-white border border-[#E5E7EB] rounded-xl text-center shadow-xs">
        <h2 className="text-base font-bold text-[#17202A]">Product Not Found</h2>
        <p className="text-xs text-[#667085] mt-1.5">{error || 'Unable to locate requested product.'}</p>
        <Link
          to="/catalog"
          className="mt-5 inline-block px-4 py-2 bg-[#1F3A5F] text-white text-xs font-semibold rounded-lg"
        >
          Return to Catalog
        </Link>
      </div>
    );
  }

  const inWishlist = isInWishlist(product._id);
  const isOutOfStock = product.stock <= 0;
  const activeImage =
    product.images && product.images.length > 0 ? product.images[selectedImageIndex]?.url : null;

  const handleAddToCart = async () => {
    try {
      await addToCart(product._id, quantity);
    } catch (err) {
      alert(err.message);
    }
  };

  const handleWishlistToggle = async () => {
    try {
      if (inWishlist) {
        await removeFromWishlist(product._id);
      } else {
        await addToWishlist(product._id);
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleReviewSubmit = async (e) => {
    e.preventDefault();
    setReviewSubmitting(true);
    setReviewError(null);

    try {
      const data = await reviewsApi.create(product._id, {
        rating: reviewRating,
        title: reviewTitle.trim() || undefined,
        comment: reviewComment.trim(),
      });

      // Update reviews list and recalculate
      setReviews([data.review, ...reviews]);
      setReviewSuccess(true);
      setTimeout(() => {
        setIsReviewModalOpen(false);
        setReviewSuccess(false);
        setReviewTitle('');
        setReviewComment('');
      }, 1500);

      // Re-fetch product to get updated rating metrics
      const refreshedProduct = await productsApi.getBySlugOrId(product._id);
      setProduct(refreshedProduct.product);
    } catch (err) {
      setReviewError(err.message);
    } finally {
      setReviewSubmitting(false);
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!window.confirm('Are you sure you want to delete this review?')) return;
    try {
      await reviewsApi.delete(reviewId);
      setReviews(reviews.filter((r) => r._id !== reviewId));
      const refreshedProduct = await productsApi.getBySlugOrId(product._id);
      setProduct(refreshedProduct.product);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-12">
      {/* Breadcrumbs */}
      <nav className="flex items-center space-x-2 text-xs text-[#667085]">
        <Link to="/" className="hover:text-[#1F3A5F]">Home</Link>
        <span>/</span>
        <Link to="/catalog" className="hover:text-[#1F3A5F]">Catalog</Link>
        {product.category && (
          <>
            <span>/</span>
            <Link to={`/catalog?category=${product.category.slug}`} className="hover:text-[#1F3A5F]">
              {product.category.name}
            </Link>
          </>
        )}
        <span>/</span>
        <span className="text-[#17202A] font-medium truncate max-w-xs">{product.name}</span>
      </nav>

      {/* Main Product Showcase */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
        {/* Gallery */}
        <div className="space-y-4">
          <div className="aspect-square rounded-2xl bg-white border border-[#E5E7EB] overflow-hidden p-6 flex items-center justify-center shadow-xs">
            {activeImage ? (
              <img
                src={activeImage}
                alt={product.name}
                className="w-full h-full object-contain max-h-[460px]"
              />
            ) : (
              <ShoppingBag size={48} className="text-gray-300" />
            )}
          </div>

          {/* Thumbnails Row */}
          {product.images && product.images.length > 1 && (
            <div className="flex items-center space-x-3 overflow-x-auto pb-2">
              {product.images.map((img, idx) => (
                <button
                  key={img.fileId || idx}
                  type="button"
                  onClick={() => setSelectedImageIndex(idx)}
                  className={`w-18 h-18 rounded-xl bg-white border overflow-hidden p-1.5 transition cursor-pointer ${
                    selectedImageIndex === idx
                      ? 'border-[#1F3A5F] ring-2 ring-[#1F3A5F]/20'
                      : 'border-[#E5E7EB] hover:border-gray-400'
                  }`}
                >
                  <img src={img.url} alt="" className="w-full h-full object-contain" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Product Information & Buy Box */}
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-xs space-y-6">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-[#667085]">
              {product.category?.name || 'Catalog Item'}
            </span>
            <h1 className="text-2xl font-bold text-[#17202A] mt-1 tracking-tight">
              {product.name}
            </h1>
            <p className="text-[11px] text-[#667085] mt-0.5">SKU: {product.sku}</p>

            {/* Ratings Bar */}
            <div className="flex items-center space-x-2 mt-3">
              <RatingStars rating={product.ratingAverage || 0} size={15} />
              <span className="text-xs font-semibold text-[#17202A]">
                {product.ratingAverage > 0 ? product.ratingAverage.toFixed(1) : 'No ratings yet'}
              </span>
              <span className="text-xs text-[#667085]">
                · {product.reviewCount} customer {product.reviewCount === 1 ? 'review' : 'reviews'}
              </span>
            </div>
          </div>

          {/* Pricing Standard */}
          <div className="border-y border-[#E5E7EB] py-4">
            <div className="flex items-baseline space-x-3">
              <span className="text-3xl font-extrabold text-[#1F3A5F]">
                ₹{product.finalPrice?.toLocaleString('en-IN')}
              </span>
              {product.discount > 0 && (
                <>
                  <span className="text-base text-gray-400 line-through">
                    ₹{product.price?.toLocaleString('en-IN')}
                  </span>
                  <span className="bg-[#2F6B4F] text-white text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {product.discount}% OFF
                  </span>
                </>
              )}
            </div>
            <p className="text-[11px] text-[#667085] mt-1">
              Inclusive of all taxes. Free express shipping on this order.
            </p>
          </div>

          {/* Inventory Status Invariant */}
          <div>
            {isOutOfStock ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-rose-50 text-[#B54747] border border-rose-200">
                <AlertCircle size={14} className="mr-1.5" />
                Currently Out of Stock
              </span>
            ) : product.stock <= 5 ? (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                <AlertCircle size={14} className="mr-1.5" />
                Low Stock Alert — Only {product.stock} units remaining!
              </span>
            ) : (
              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-[#2F6B4F] border border-emerald-200">
                <Check size={14} className="mr-1.5" />
                In Stock & Ready to Ship
              </span>
            )}
          </div>

          {/* Description */}
          <div className="text-xs text-[#17202A] leading-relaxed border-t border-[#E5E7EB] pt-4">
            <h3 className="font-semibold text-xs uppercase tracking-wider text-[#667085] mb-2">
              Product Overview
            </h3>
            <p className="whitespace-pre-line">{product.description}</p>
          </div>

          {/* Purchase Controls */}
          {!isOutOfStock && (
            <div className="flex items-center space-x-4 pt-2">
              <span className="text-xs font-medium text-[#667085]">Quantity:</span>
              <div className="inline-flex items-center rounded-lg border border-[#E5E7EB] bg-[#F7F7F5]">
                <button
                  type="button"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                  disabled={quantity <= 1}
                  className="p-2 text-gray-600 hover:text-black disabled:opacity-30 cursor-pointer"
                  aria-label="Decrease quantity"
                >
                  <Minus size={14} />
                </button>
                <span className="w-10 text-center text-xs font-bold text-[#17202A]">
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(Math.min(product.stock, quantity + 1))}
                  disabled={quantity >= product.stock || quantity >= 10}
                  className="p-2 text-gray-600 hover:text-black disabled:opacity-30 cursor-pointer"
                  aria-label="Increase quantity"
                >
                  <Plus size={14} />
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center space-x-3 pt-2">
            <button
              type="button"
              onClick={handleAddToCart}
              disabled={isOutOfStock || cartLoading}
              className="flex-1 py-3 px-6 rounded-xl bg-[#1F3A5F] text-white text-xs font-semibold flex items-center justify-center space-x-2 hover:bg-[#172D4A] transition shadow-xs disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              <ShoppingBag size={16} />
              <span>{isOutOfStock ? 'Sold Out' : 'Add to Shopping Cart'}</span>
            </button>

            <button
              type="button"
              onClick={handleWishlistToggle}
              className={`p-3 rounded-xl border transition cursor-pointer flex items-center justify-center ${
                inWishlist
                  ? 'bg-rose-50 border-rose-200 text-rose-600'
                  : 'bg-white border-[#E5E7EB] text-gray-600 hover:bg-gray-50'
              }`}
              aria-label={inWishlist ? 'Remove from wishlist' : 'Add to wishlist'}
            >
              <Heart size={18} className={inWishlist ? 'fill-rose-500' : ''} />
            </button>
          </div>
        </div>
      </div>

      {/* Verified Reviews Section */}
      <div className="bg-white rounded-2xl border border-[#E5E7EB] p-8 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-[#E5E7EB] pb-6 gap-4">
          <div>
            <h2 className="text-lg font-bold text-[#17202A]">Customer Reviews</h2>
            <p className="text-xs text-[#667085] mt-0.5">
              Verified buyers who have received this product
            </p>
          </div>

          <button
            type="button"
            onClick={() => {
              if (!isAuthenticated) {
                alert('Please sign in to write a review');
                return;
              }
              setIsReviewModalOpen(true);
            }}
            className="px-4 py-2 rounded-lg bg-white border border-[#1F3A5F] text-[#1F3A5F] text-xs font-semibold hover:bg-blue-50/50 transition cursor-pointer shrink-0"
          >
            Write a Review
          </button>
        </div>

        {/* Reviews List */}
        <div className="divide-y divide-[#E5E7EB] mt-4">
          {reviews.length === 0 ? (
            <div className="py-12 text-center">
              <p className="text-xs text-[#667085]">
                No customer reviews yet. Verified purchasers can submit reviews after delivery.
              </p>
            </div>
          ) : (
            reviews.map((rev) => (
              <div key={rev._id} className="py-5 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold text-[#17202A]">
                      {rev.user?.name || 'Verified Customer'}
                    </span>
                    {rev.isVerifiedPurchase && (
                      <span className="inline-flex items-center text-[10px] font-semibold text-[#2F6B4F] bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        <ShieldCheck size={12} className="mr-1" />
                        Verified Purchase
                      </span>
                    )}
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className="text-[11px] text-[#667085]">
                      {new Date(rev.createdAt).toLocaleDateString('en-IN', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>

                    {(isAdmin || (user && rev.user?._id === user._id)) && (
                      <button
                        type="button"
                        onClick={() => handleDeleteReview(rev._id)}
                        className="text-gray-400 hover:text-[#B54747] p-1"
                        aria-label="Delete review"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <RatingStars rating={rev.rating} size={13} />

                {rev.title && (
                  <h4 className="text-xs font-bold text-[#17202A] mt-1">{rev.title}</h4>
                )}
                <p className="text-xs text-[#667085] leading-relaxed">{rev.comment}</p>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Review Submission Modal */}
      <Modal
        isOpen={isReviewModalOpen}
        onClose={() => setIsReviewModalOpen(false)}
        title="Write a Customer Review"
      >
        <form onSubmit={handleReviewSubmit} className="space-y-4">
          {reviewSuccess ? (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg text-center text-xs font-semibold text-[#2F6B4F]">
              Thank you! Your verified review has been published.
            </div>
          ) : (
            <>
              {reviewError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-xs text-[#B54747] font-medium">
                  {reviewError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[#17202A] mb-1">
                  Overall Rating
                </label>
                <div className="flex items-center space-x-2">
                  <RatingStars
                    rating={reviewRating}
                    interactive={true}
                    size={22}
                    onChange={(val) => setReviewRating(val)}
                  />
                  <span className="text-xs text-[#667085] font-medium">
                    ({reviewRating} of 5 stars)
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17202A] mb-1">
                  Headline / Title (Optional)
                </label>
                <input
                  type="text"
                  value={reviewTitle}
                  onChange={(e) => setReviewTitle(e.target.value)}
                  placeholder="e.g. Highly recommended for daily use"
                  maxLength={100}
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#17202A] mb-1">
                  Review Comment *
                </label>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  rows={4}
                  required
                  minLength={5}
                  maxLength={1000}
                  placeholder="What did you like or dislike about this product? (min 5 characters)"
                  className="w-full px-3 py-2 text-xs border border-[#E5E7EB] rounded-lg focus:ring-2 focus:ring-[#1F3A5F] focus:outline-none"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-[#667085] hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reviewSubmitting || reviewComment.trim().length < 5}
                  className="px-5 py-2 text-xs font-semibold bg-[#1F3A5F] text-white rounded-lg hover:bg-[#172D4A] disabled:opacity-50"
                >
                  {reviewSubmitting ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </>
          )}
        </form>
      </Modal>
    </div>
  );
}
