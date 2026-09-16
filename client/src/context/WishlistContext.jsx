import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { wishlistApi } from '../services/api';
import { useAuth } from './AuthContext';
import { useCart } from './CartContext';

const WishlistContext = createContext(null);

export function WishlistProvider({ children }) {
  const { isAuthenticated } = useAuth();
  const { refreshCart, openDrawer } = useCart();
  const [wishlist, setWishlist] = useState(null);
  const [loading, setLoading] = useState(false);

  const fetchWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      setWishlist(null);
      return;
    }
    try {
      const data = await wishlistApi.get();
      setWishlist(data.wishlist);
    } catch (err) {
      console.error('Failed to fetch wishlist:', err);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    fetchWishlist();
  }, [fetchWishlist]);

  const addToWishlist = async (productId) => {
    if (!isAuthenticated) {
      throw new Error('Please log in to manage your wishlist');
    }
    setLoading(true);
    try {
      const data = await wishlistApi.add(productId);
      setWishlist(data.wishlist);
      return data.wishlist;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const removeFromWishlist = async (productId) => {
    setLoading(true);
    try {
      const data = await wishlistApi.remove(productId);
      setWishlist(data.wishlist);
      return data.wishlist;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const moveToCart = async (productId) => {
    setLoading(true);
    try {
      const data = await wishlistApi.moveToCart(productId);
      setWishlist(data.wishlist);
      await refreshCart();
      openDrawer();
      return data;
    } catch (err) {
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const isInWishlist = (productId) => {
    if (!wishlist?.products) return false;
    return wishlist.products.some(
      (p) => (p._id ? p._id.toString() : p.toString()) === productId.toString()
    );
  };

  const value = {
    wishlist,
    products: wishlist?.products || [],
    wishlistCount: wishlist?.products?.length || 0,
    loading,
    addToWishlist,
    removeFromWishlist,
    moveToCart,
    isInWishlist,
    refreshWishlist: fetchWishlist,
  };

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const context = useContext(WishlistContext);
  if (!context) {
    throw new Error('useWishlist must be used within a WishlistProvider');
  }
  return context;
}
