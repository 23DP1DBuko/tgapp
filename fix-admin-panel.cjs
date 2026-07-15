const fs = require('fs');
let content = fs.readFileSync('src/components/rewards/RewardsAdminPanel.tsx', 'utf8');

// Fix: isActive -> status === 'live'
content = content.replace(/\.isActive/g, "['__isActive__']");
content = content.replace(/\[['\"]__isActive__['\"]\]/g, ".status === 'live'");

// Fix: .endsAt -> .endAt (on Giveaway type)
content = content.replace(/\.endsAt/g, '.endAt');

// Fix: .totalTickets -> .totalTicketsPool
content = content.replace(/\.totalTickets(?!Pool)/g, '.totalTicketsPool');

fs.writeFileSync('src/components/rewards/RewardsAdminPanel.tsx', content, 'utf8');
console.log('Admin panel fix applied successfully');
