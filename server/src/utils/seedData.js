const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const mongoose = require('mongoose');
const User = require('../models/User');
const Category = require('../models/Category');
const Product = require('../models/Product');
const Cart = require('../models/Cart');
const { connectDB, disconnectDB } = require('../config/db');

const seedData = async () => {
  try {
    console.log('[Seeder] Connecting to MongoDB Atlas...');
    await connectDB();

    console.log('[Seeder] Cleaning existing demo records...');
    await User.deleteMany({ email: { $in: ['admin@shopsphere.com', 'customer@shopsphere.com'] } });
    await Category.deleteMany({ slug: { $in: ['electronics-and-audio', 'books-and-engineering', 'keyboards-and-accessories'] } });

    console.log('[Seeder] Creating demo users...');
    const admin = await User.create({
      name: 'ShopSphere Admin',
      email: 'admin@shopsphere.com',
      passwordHash: 'Admin@1234',
      role: 'ADMIN',
    });

    const customer = await User.create({
      name: 'Hemant Customer',
      email: 'customer@shopsphere.com',
      passwordHash: 'Customer@1234',
      role: 'CUSTOMER',
    });

    console.log('[Seeder] Creating categories...');
    const electronics = await Category.create({
      name: 'Electronics & Audio',
      slug: 'electronics-and-audio',
      description: 'Industry-standard noise-cancelling headphones, wireless earbuds, and portable sound systems',
    });

    const books = await Category.create({
      name: 'Books & Engineering',
      slug: 'books-and-engineering',
      description: 'Software design, distributed systems, and computer science engineering textbooks',
    });

    const keyboards = await Category.create({
      name: 'Keyboards & Accessories',
      slug: 'keyboards-and-accessories',
      description: 'Premium mechanical keyboards, custom switches, and ergonomic desktop accessories',
    });

    console.log('[Seeder] Creating products with realistic pricing and inventory levels...');
    const products = await Product.create([
      {
        name: 'Sony WH-1000XM5 Wireless Noise-Cancelling Headphones',
        description: 'Industry-leading noise cancellation with two processors and 8 microphones. Up to 30 hours of battery life with quick charging. Premium sound quality with Hi-Res Audio.',
        price: 29990,
        discount: 10,
        category: electronics._id,
        stock: 25,
        ratingAverage: 4.8,
        reviewCount: 142,
        images: [{ url: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=800', fileId: 'demo_sony' }],
      },
      {
        name: 'Bose QuietComfort 45 Bluetooth Headphones',
        description: 'Iconic quiet, comfort, and sound. High-fidelity audio with adjustable EQ that lets you tune your music to your liking. 24 hours of battery on a single charge.',
        price: 24900,
        discount: 5,
        category: electronics._id,
        stock: 0, // Out of stock for testing inventory degradation & warnings
        ratingAverage: 4.6,
        reviewCount: 98,
        images: [{ url: 'https://images.unsplash.com/photo-1546435770-a3e426bf472b?w=800', fileId: 'demo_bose' }],
      },
      {
        name: 'Anker Soundcore Motion+ Hi-Res Bluetooth Speaker',
        description: 'Ultra-wide frequency range for remarkable sound. 30W audio with deep bass and high clarity. IPX7 waterproof casing for outdoor use with 12-hour playtime.',
        price: 7999,
        discount: 15,
        category: electronics._id,
        stock: 40,
        ratingAverage: 4.5,
        reviewCount: 76,
        images: [{ url: 'https://images.unsplash.com/photo-1608043152269-423dbba4e7e1?w=800', fileId: 'demo_anker' }],
      },
      {
        name: 'Designing Data-Intensive Applications',
        description: 'The definitive guide to the architecture, storage engines, distributed consensus, and streaming systems behind modern scalable software systems by Martin Kleppmann.',
        price: 1850,
        discount: 10,
        category: books._id,
        stock: 100,
        ratingAverage: 4.9,
        reviewCount: 420,
        images: [{ url: 'https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?w=800', fileId: 'demo_ddia' }],
      },
      {
        name: 'Clean Code: A Handbook of Agile Software Craftsmanship',
        description: 'Practical principles, patterns, and practices for writing clean, robust, and maintainable software. Essential reading for professional software engineers.',
        price: 1450,
        discount: 0,
        category: books._id,
        stock: 60,
        ratingAverage: 4.7,
        reviewCount: 310,
        images: [{ url: 'https://images.unsplash.com/photo-1532012164546-f432f2e3777a?w=800', fileId: 'demo_cleancode' }],
      },
      {
        name: 'Keychron Q1 Pro Wireless Custom Mechanical Keyboard',
        description: 'Full aluminum CNC machined body, hot-swappable switches, QMK/VIA programmable, and double-gasket acoustic design for a supremely satisfying typing experience.',
        price: 17999,
        discount: 8,
        category: keyboards._id,
        stock: 15,
        ratingAverage: 4.8,
        reviewCount: 64,
        images: [{ url: 'https://images.unsplash.com/photo-1587829741301-dc798b83add3?w=800', fileId: 'demo_keychron' }],
      },
      {
        name: 'Logitech MX Master 3S Wireless Performance Mouse',
        description: 'Quiet clicks and 8K DPI track-on-glass sensor. MagSpeed electromagnetic scrolling for remarkable speed and precision. Ergonomic sculpted silhouette.',
        price: 8995,
        discount: 12,
        category: keyboards._id,
        stock: 35,
        ratingAverage: 4.9,
        reviewCount: 225,
        images: [{ url: 'https://images.unsplash.com/photo-1615663245857-ac93bb7c39e7?w=800', fileId: 'demo_mxmaster' }],
      },
    ]);

    // Seed customer cart with 1 item for immediate inspection
    await Cart.deleteOne({ user: customer._id });
    await Cart.create({
      user: customer._id,
      items: [
        { product: products[0]._id, quantity: 1 },
        { product: products[3]._id, quantity: 2 },
      ],
    });

    console.log('\n=============================================================');
    console.log('       SHOPSPHERE DATABASE SEED COMPLETED SUCCESSFULLY');
    console.log('=============================================================');
    console.log('Demo Credentials:');
    console.log('  👑 Admin:    admin@shopsphere.com    | Password: Admin@1234');
    console.log('  🛒 Customer: customer@shopsphere.com | Password: Customer@1234');
    console.log(`\nCreated ${products.length} catalog items across 3 categories with live inventory!`);
    console.log('=============================================================\n');

    await disconnectDB();
    process.exit(0);
  } catch (err) {
    console.error('[Seeder] Error seeding database:', err);
    await disconnectDB();
    process.exit(1);
  }
};

seedData();
