#!/usr/bin/env node

/**
 * Seed script for YUNGWEAR Mini App
 * ===================================
 *
 * Populates Firestore with initial data for campaigns, polls,
 * tasks, giveaways, and referral configuration.
 *
 * Usage:
 *   1. Ensure FIREBASE_SERVICE_ACCOUNT_KEY (path to JSON file) is set:
 *      export FIREBASE_SERVICE_ACCOUNT_KEY="./service-account.json"
 *
 *   2. Or set FIREBASE_PROJECT_ID (needed with application-default credentials):
 *      export FIREBASE_PROJECT_ID="yungwearapp-6f98d"
 *
 *   3. Or use "firebase login" for application-default credentials.
 *
 *   4. Run: node functions/seed-data.mjs
 */

import { readFileSync } from 'fs';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';

// ── Initialize Firebase Admin ──

function initAdmin() {
  if (getApps().length > 0) return getFirestore();

  const projectId = process.env.FIREBASE_PROJECT_ID;

  // Try loading from env variable or default credentials
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (serviceAccountPath) {
    const serviceAccount = JSON.parse(
      readFileSync(serviceAccountPath, 'utf-8')
    );
    initializeApp({ credential: cert(serviceAccount), projectId });
  } else {
    // Falls back to GOOGLE_APPLICATION_CREDENTIALS env var
    initializeApp({ projectId });
  }
  return getFirestore();
}

const db = initAdmin();
const now = () => new Date().toISOString();

// ── Helpers ──

async function createDocument(collection, data) {
  const ref = await db.collection(collection).add({
    ...data,
    createdAt: now(),
    updatedAt: now(),
  });
  console.log(`  ✓ ${collection}: ${ref.id}`);
  return ref.id;
}

async function createDocumentWithId(collection, id, data) {
  await db.collection(collection).doc(id).set({
    ...data,
    createdAt: now(),
    updatedAt: now(),
  });
  console.log(`  ✓ ${collection}: ${id}`);
  return id;
}

// ── 1. Campaigns (Carousel slides) ──

async function seedCampaigns() {
  console.log('\n📢 Seeding campaigns...');

  const campaigns = [
    {
      tag: 'Live Now',
      headingPart1: 'DROP 01',
      headingPart2: 'AVAILABLE NOW',
      subtitle: 'Limited pieces • First come, first served',
      isActive: true,
      sortOrder: 0,
    },
    {
      tag: 'New Arrivals',
      headingPart1: 'FRESH',
      headingPart2: 'NEW ARRIVALS',
      subtitle: 'Latest pieces added to the collection',
      isActive: true,
      sortOrder: 1,
    },
    {
      tag: 'Limited Edition',
      headingPart1: 'EXCLUSIVE',
      headingPart2: 'ONE-OF-ONE',
      subtitle: 'Unique pieces you will not find elsewhere',
      isActive: true,
      sortOrder: 2,
    },
  ];

  for (const campaign of campaigns) {
    await createDocument('campaigns', campaign);
  }
}

// ── 2. Banner Slides (hero carousel) ──

async function seedBannerSlides() {
  console.log('\n🖼️  Seeding banner slides...');

  const slides = [
    {
      imageUrl: '',
      badgeText: 'Live Now',
      headline: 'DROP 01',
      subheading: 'AVAILABLE NOW',
      caption: 'Limited pieces • First come, first served',
      isActive: true,
      sortOrder: 0,
    },
    {
      imageUrl: '',
      badgeText: 'New',
      headline: 'FRESH',
      subheading: 'NEW ARRIVALS',
      caption: 'Latest pieces added to the collection',
      isActive: true,
      sortOrder: 1,
    },
    {
      imageUrl: '',
      badgeText: 'Exclusive',
      headline: 'EXCLUSIVE',
      subheading: 'ONE-OF-ONE',
      caption: 'Unique pieces you will not find elsewhere',
      isActive: true,
      sortOrder: 2,
    },
  ];

  for (const slide of slides) {
    await createDocument('bannerSlides', slide);
  }
}

// ── 3. Reward Tasks ──

async function seedTasks() {
  console.log('\n📋 Seeding reward tasks...');

  const tasks = [
    {
      title: 'Invite a Friend via Referral Link',
      rewardType: 'coupon',
      rewardValue: '10% OFF COUPON',
      status: 'active',
      sortOrder: 0,
      actionUrl: '',
      actionLabel: 'Share Link',
    },
    {
      title: 'Subscribe to YUNGWEAR Channel',
      rewardType: 'ticket',
      rewardValue: '1 Ticket',
      status: 'active',
      sortOrder: 1,
      actionUrl: 'https://t.me/yungwearstore',
      actionLabel: 'Join & Verify',
    },
    {
      title: 'Follow @yungwear.store on Instagram',
      rewardType: 'ticket',
      rewardValue: '2 Tickets',
      status: 'active',
      sortOrder: 2,
      actionUrl: 'https://www.instagram.com/yungwear.store/',
      actionLabel: 'Follow',
    },
    {
      title: 'Follow @yungwear.store on TikTok',
      rewardType: 'ticket',
      rewardValue: '2 Tickets',
      status: 'active',
      sortOrder: 3,
      actionUrl: 'https://www.tiktok.com/@yungwear.store',
      actionLabel: 'Follow',
    },
    {
      title: 'Like 5 Products in the Store',
      rewardType: 'ticket',
      rewardValue: '1 Ticket',
      status: 'active',
      sortOrder: 4,
      actionUrl: '',
      actionLabel: 'Browse Store',
    },
  ];

  for (const task of tasks) {
    await createDocument('tasks', task);
  }
}

// ── 4. Community Polls ──

async function seedPolls() {
  console.log('\n📊 Seeding community polls...');

  const polls = [
    {
      title: 'What should our next drop focus on?',
      description: 'Help us decide what type of pieces to release next.',
      options: [
        { label: 'Hoodies', imageUrl: '', votes: 0 },
        { label: 'T-Shirts', imageUrl: '', votes: 0 },
        { label: 'Accessories', imageUrl: '', votes: 0 },
        { label: 'Outerwear', imageUrl: '', votes: 0 },
      ],
      totalVotes: 0,
      isActive: true,
    },
    {
      title: 'Which colorway for the next drop?',
      description: 'Vote for your favorite color palette.',
      options: [
        { label: 'Black / White', imageUrl: '', votes: 0 },
        { label: 'Purple / Magenta', imageUrl: '', votes: 0 },
        { label: 'Earth Tones', imageUrl: '', votes: 0 },
      ],
      totalVotes: 0,
      isActive: true,
    },
    {
      title: 'Preferred payment method?',
      description: 'How would you like to pay for your pieces?',
      options: [
        { label: 'Cash (Meetup)', imageUrl: '', votes: 0 },
        { label: 'USDT (Crypto)', imageUrl: '', votes: 0 },
        { label: 'Bank Transfer', imageUrl: '', votes: 0 },
      ],
      totalVotes: 0,
      isActive: true,
    },
  ];

  for (const poll of polls) {
    await createDocument('polls', poll);
  }
}

// ── 5. Giveaway (rich schema with prizes & entry tasks) ──

async function seedGiveaways() {
  console.log('\n🎁 Seeding giveaways...');

  const giveaways = [
    {
      title: 'DROP 01 Launch Giveaway',
      description:
        'Win the full DROP 01 collection! Enter for a chance to grab all the pieces from our first drop. Complete tasks to increase your ticket count.',
      status: 'live',
      startAt: null,
      endAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 2 weeks from now
      prizes: [
        {
          productId: '',
          productName: 'DROP 01 Hoodie',
          productImage: '',
          place: 1,
        },
        {
          productId: '',
          productName: 'DROP 01 T-Shirt',
          productImage: '',
          place: 2,
        },
      ],
      winnersCount: 2,
      accessLevel: 'public',
      entryTasks: [
        {
          id: 'task_join_channel',
          type: 'join_channel',
          label: 'Join our Telegram channel',
          ticketsGranted: 3,
          verifyMethod: 'manual',
        },
        {
          id: 'task_invite',
          type: 'invite_friend',
          label: 'Invite 3 friends',
          ticketsGranted: 5,
          verifyMethod: 'referral_count',
        },
      ],
      baseEntryTickets: 1,
      enteredCount: 0,
      totalTicketsPool: 0,
      winners: null,
      finishedAt: null,
    },
  ];

  for (const giveaway of giveaways) {
    await createDocument('giveaways', giveaway);
  }
}

// ── 6. Set up referral reward tiers in app metadata ──

async function seedReferralConfig() {
  console.log('\n🔗 Seeding referral configuration...');

  // Create a document in a 'config' collection or use an existing mechanism
  // The referral reward tiers are currently hardcoded in the functions.
  // We'll create a config document to make them overridable.

  const config = {
    rewardTiers: [
      { threshold: 1, discountPercent: 5, codeSuffix: '5', label: '5% Off' },
      { threshold: 3, discountPercent: 10, codeSuffix: '10', label: '10% Off' },
      { threshold: 5, discountPercent: 15, codeSuffix: '15', label: '15% Off' },
    ],
    updatedAt: now(),
  };

  await createDocumentWithId('config', 'referral_rewards', config);
}

// ── 7. Promo codes ──

async function seedPromoCodes() {
  console.log('\n🏷️  Seeding promo codes...');

  const promoCodes = [
    {
      code: 'WELCOME10',
      discountType: 'percentage',
      discountValue: 10,
      isActive: true,
      expiresAt: Timestamp.fromDate(
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
      ), // 90 days
      usageLimit: 50,
      usageCount: 0,
    },
    {
      code: 'DROP01',
      discountType: 'fixed_amount',
      discountValue: 15,
      isActive: true,
      expiresAt: Timestamp.fromDate(
        new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      ), // 30 days
      usageLimit: 20,
      usageCount: 0,
    },
  ];

  for (const promo of promoCodes) {
    await createDocument('promoCodes', promo);
  }
}

// ── Main ──

async function main() {
  console.log('🌱 YUNGWEAR — Seeding database...\n');

  try {
    await seedCampaigns();
    await seedBannerSlides();
    await seedTasks();
    await seedPolls();
    await seedGiveaways();
    await seedReferralConfig();
    await seedPromoCodes();

    console.log('\n✅ Seeding complete!');
    console.log(
      '   Start the app and use the admin panel (triple-tap the title) to upload product images for campaigns & giveaways.'
    );
  } catch (error) {
    console.error('\n❌ Seeding failed:', error.message);
    process.exit(1);
  }
}

main();
