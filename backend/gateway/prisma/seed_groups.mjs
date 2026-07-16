// Seed mock groups with varying member counts for the signed-in user.
//
// Groups only appear in GET /api/groups for their members, so this attaches
// YOUR account to every seeded group. Sign up first, then run with your email
// or username:
//
//   cd backend/gateway
//   bun prisma/seed_groups.mjs you@example.com
//   bun prisma/seed_groups.mjs devpatel
//
// Idempotent: re-running deletes the previously-seeded groups (by name) and the
// mock co-members (by their seed_* usernames), then recreates them. Your own
// account and any non-seed data are left untouched.

import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// Mock co-members. These are bare User rows (no Better Auth Account), so they
// can't log in — they exist only to populate group membership. Usernames are
// prefixed seed_ so the cleanup step can find and remove them.
const MOCK_MEMBERS = [
  { username: 'seed_sofia', display_name: 'Sofia Rivera' },
  { username: 'seed_tomas', display_name: 'Tomás Nguyen' },
  { username: 'seed_maya', display_name: 'Maya Patel' },
  { username: 'seed_dev', display_name: 'Dev Shah' },
  { username: 'seed_priya', display_name: 'Priya Kapoor' },
  { username: 'seed_liam', display_name: 'Liam O’Brien' },
  { username: 'seed_yuki', display_name: 'Yuki Tanaka' },
  { username: 'seed_amara', display_name: 'Amara Okafor' },
]

// Groups to create. member_count = how many co-members to add ALONGSIDE you, so
// the total membership is member_count + 1 (you). Counts deliberately vary.
// `preview` seeds one opening chat message so the sidebar has a last_message.
const GROUPS = [
  { name: 'Work Lunch Crew', coMembers: 7, preview: 'Just joined the session 🎉' }, // 8 total
  { name: 'Friday Friends', coMembers: 4, preview: 'This Friday?' }, //               5 total
  { name: 'Dev + Maya', coMembers: 1, preview: 'See you there!' }, //                 2 total
  { name: 'Date Night', coMembers: 2, preview: 'Saturday works 😊' }, //              3 total
  { name: 'Solo Cravings', coMembers: 0, preview: null }, //                          1 total (just you)
]

async function main() {
  const identifier = process.argv[2]
  if (!identifier) {
    console.error(
      'Usage: bun prisma/seed_groups.mjs <your-email-or-username>\n' +
        '(Sign up in the app first so your account exists.)',
    )
    process.exitCode = 1
    return
  }

  // Resolve YOUR account by email or username.
  const me = await prisma.user.findFirst({
    where: { OR: [{ email: identifier }, { username: identifier }] },
    select: { id: true, username: true, display_name: true },
  })
  if (!me) {
    console.error(
      `No user found matching "${identifier}". Sign up in the app first, then ` +
        're-run with the exact email or username you registered.',
    )
    process.exitCode = 1
    return
  }
  console.log(`Attaching groups to: ${me.display_name ?? me.username} (id ${me.id})`)

  // --- Cleanup previous seed (idempotent re-run) ---
  const seedNames = GROUPS.map((g) => g.name)
  // Delete groups by name (cascades to GroupMember + GroupMessage).
  const deletedGroups = await prisma.group.deleteMany({ where: { name: { in: seedNames } } })
  // Delete mock co-members by their seed_ usernames (cascades their memberships).
  const deletedUsers = await prisma.user.deleteMany({
    where: { username: { in: MOCK_MEMBERS.map((m) => m.username) } },
  })
  console.log(
    `Cleaned up ${deletedGroups.count} prior seed group(s), ${deletedUsers.count} mock user(s).`,
  )

  // --- Recreate mock co-members ---
  await prisma.user.createMany({
    data: MOCK_MEMBERS.map((m) => ({
      username: m.username,
      // Unique placeholder email; these accounts never log in.
      email: `${m.username}@seed.grubgroup.local`,
      display_name: m.display_name,
    })),
  })
  const members = await prisma.user.findMany({
    where: { username: { in: MOCK_MEMBERS.map((m) => m.username) } },
    select: { id: true, username: true, display_name: true },
  })
  // Guard: never let the pool run short of the largest group's co-member need.
  const maxCo = Math.max(...GROUPS.map((g) => g.coMembers))
  if (members.length < maxCo) {
    throw new Error(`Need ${maxCo} mock members but only ${members.length} exist.`)
  }

  // --- Create groups, each including YOU + the first N co-members ---
  for (const g of GROUPS) {
    const coMemberIds = members.slice(0, g.coMembers).map((m) => m.id)
    // Dedupe in case your account somehow overlaps a seed id (it won't here).
    const memberIds = [...new Set([me.id, ...coMemberIds])]

    const group = await prisma.group.create({
      data: {
        name: g.name,
        members: { create: memberIds.map((user_id) => ({ user_id })) },
      },
      select: { id: true },
    })

    // Seed one opening message (from the first co-member if any, else you) so
    // the sidebar shows a preview + last-activity time.
    if (g.preview) {
      const author = coMemberIds[0] ?? me.id
      await prisma.groupMessage.create({
        data: { group_id: group.id, user_id: author, content: g.preview, message_type: 'TEXT' },
      })
    }

    console.log(`  ${g.name}: ${memberIds.length} members`)
  }

  console.log('Done.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
