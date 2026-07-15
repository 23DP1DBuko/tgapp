const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, 'src', 'giveaways.ts')
let c = fs.readFileSync(filePath, 'utf8')

// Find the orphaned TelegramInitDataUser body that starts right after DrawGiveawayAdminResponse
// Markers: "internal_error'\n}\n\n  id?: number\n" is the signal
const marker = "internal_error'\n    }\n\n  id?: number\n  [key: string]: unknown\n}"
const idx = c.indexOf(marker)
if (idx >= 0) {
  // The orphan block starts after the closing } of DrawGiveawayAdminResponse
  // Fix: find the end of the orphan (empty line then next export const)
  const afterOrphan = c.indexOf('\n\nexport const upsertGiveawayAdmin', idx)
  if (afterOrphan >= 0) {
    // Remove from the orphan start to just before the export const
    c = c.slice(0, idx + marker.length) + c.slice(afterOrphan)
    fs.writeFileSync(filePath, c, 'utf8')
    console.log('Fixed: removed orphaned type body (1 occurrence)')
  } else {
    console.log('Could not find closing boundary')
  }
} else {
  console.log('Marker not found, checking alternatives...')
  // Try without the exact spacing
  const altMarker = 'id?: number\n  [key: string]: unknown\n}'
  const idx2 = c.indexOf(altMarker, c.indexOf('DrawGiveawayAdminResponse'))
  if (idx2 >= 0) {
    // Find the proper start of this block
    const blockStart = c.lastIndexOf('\n\n', idx2)
    const afterOrphan2 = c.indexOf('\n\nexport const', idx2)
    if (blockStart >= 0 && afterOrphan2 >= 0) {
      c = c.slice(0, blockStart) + c.slice(afterOrphan2)
      fs.writeFileSync(filePath, c, 'utf8')
      console.log('Fixed (alt): removed orphaned type body')
    }
  } else {
    console.log('No orphaned body found')
  }
}
