import { Link } from 'react-router-dom';
import { Heart, ShoppingBag, Trash2, ArrowRight } from 'lucide-react';
import { useWishlist } from '../context/WishlistContext';
import { useAuth } from '../context/AuthContext';
import RatingStars from '../components/RatingStars';

export default function WishlistPage() {
  const { isAuthenticated } = useAuth();
  const { products, removeFromWishlist, moveToCart, loading } = useWishlist();

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto my-16 p-8 bg-white border border-[#E5E7EB] rounded-2xl text-center shadow-xs">
        <Heart size={32} className="text-[#1F3A5F] mx-auto mb-3" />
        <h2 className="text-base font-bold text-[#17202A]">Sign in to View Wishlist</h2>
        <p className="text-xs text-[#667085] mt-1">
          Save items you love and access them across all your devices.
        </p>
        <Link
          to="/login?redirect=/wishlist"
          className="mt-5 inline-block px-5 py-2.5 bg-[#1F3A5F] text-white text-xs font-semibold rounded-lg hover:bg-[#172D4A] transition"
        >
          Sign In
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#17202A] tracking-tight">
          My Saved Wishlist
        </h1>
        <p className="text-xs text-[#667085] mt-1">
          {products.length} {products.length === 1 ? 'item' : 'items'} saved for later
        </p>
      </div>

      {products.length === 0 ? (
        <div className="bg-white rounded-2xl border border-[#E5E7EB] p-12 text-center shadow-xs">
          <div className="w-14 h-14 rounded-full bg-[#F7F7F5] flex items-center justify-center text-gray-400 mx-auto mb-3">
            <Heart size={28} />
          </div>
          <h3 className="text-base font-bold text-[#17202A]">Your wishlist is currently empty</h3>
          <p className="text-xs text-[#667085] mt-1">
            Tap the heart icon on any product to save it to your wishlist.
          </p>
          <Link
            to="/catalog"
            className="mt-5 inline-block px-5 py-2.5 bg-[#1F3A5F] text-white text-xs font-semibold rounded-lg hover:bg-[#172D4A] transition shadow-xs"
          >
            Explore Catalog
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
          {products.map((product) => {
            const isOutOfStock = product.stock <= 0;

            return (
              <div
                key={product._id}
                className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden hover:shadow-md transition flex flex-col justify-between"
              >
                {/* Image */}
                <div className="relative aspect-square overflow-hidden bg-[#F7F7F5]">
                  {product.images && product.images.length > 0 ? (
                    <img
                      src={product.images[0].url}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-300">
                      <ShoppingBag size={32} />
                    </div>
                  )}

                  <button
                    type="button"
                    onClick={() => removeFromWishlist(product._id)}
                    className="absolute top-2.5 right-2.5 w-8 h-8 rounded-full bg-white/90 backdrop-blur-xs flex items-center justify-center shadow-xs text-gray-400 hover:text-[#B54747] transition cursor-pointer"
                    aria-label="Remove from wishlist"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>

                {/* Content */}
                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <h3 className="text-xs font-semibold text-[#17202A] line-clamp-2 hover:text-[#1F3A5F] transition">
                      <Link to={`/products/${product.slug || product._id}`}>
                        {product.name}
                      </Link>
                    </h3>

                    <div className="flex items-center space-x-1.5 mt-2">
                      <RatingStars rating={product.ratingAverage || 0} size={12} />
                      <span className="text-[11px] text-[#667085]">
                        ({product.reviewCount || 0})
                      </span>
                    </div>

                    <div className="mt-3">
                      <span className="text-sm font-bold text-[#17202A]">
                        ₹{product.price?.toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>

                  {/* Move to Cart Action */}
                  <div className="mt-4 pt-3 border-t border-[#E5E7EB]">
                    <button
                      type="button"
                      onClick={() => moveToCart(product._id)}
                      disabled={isOutOfStock || loading}
                      className="w-full py-2 px-3 rounded-lg bg-[#1F3A5F] text-white text-xs font-semibold flex items-center justify-center space-x-1.5 hover:bg-[#172D4A] transition disabled:opacity-50 cursor-pointer shadow-xs"
                    >
                      <ShoppingBag size={14} />
                      <span>{isOutOfStock ? 'Sold Out' : 'Move to Cart'}</span>
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
