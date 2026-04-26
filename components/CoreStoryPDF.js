import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer'

const green  = '#1D9E75'
const dark   = '#111827'
const mid    = '#374151'
const muted  = '#6B7280'
const border = '#E5E7EB'
const white  = '#FFFFFF'
const light  = '#F9FAFB'
const accent = '#F0FAF6'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    backgroundColor: white,
    paddingBottom: 50,
  },
  // Header
  header: {
    backgroundColor: green,
    paddingVertical: 32,
    paddingHorizontal: 44,
  },
  headerEyebrow: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 8,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 10,
  },
  headerBiz: {
    color: white,
    fontSize: 24,
    fontFamily: 'Helvetica-Bold',
    marginBottom: 6,
  },
  headerSub: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 10,
    lineHeight: 1.5,
  },
  // Pitch callout
  pitchWrap: {
    backgroundColor: accent,
    borderLeftWidth: 4,
    borderLeftColor: green,
    marginHorizontal: 44,
    marginTop: 28,
    marginBottom: 8,
    padding: 18,
  },
  pitchLabel: {
    color: green,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  pitchText: {
    color: dark,
    fontSize: 10,
    lineHeight: 1.75,
    fontFamily: 'Helvetica-Oblique',
  },
  // Body
  body: {
    paddingHorizontal: 44,
    paddingTop: 12,
  },
  section: {
    marginBottom: 22,
    paddingBottom: 22,
    borderBottomWidth: 1,
    borderBottomColor: border,
  },
  sectionLast: {
    marginBottom: 20,
  },
  sectionLabel: {
    color: green,
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 7,
  },
  sectionTitle: {
    color: dark,
    fontSize: 14,
    fontFamily: 'Helvetica-Bold',
    lineHeight: 1.4,
  },
  sectionBody: {
    color: mid,
    fontSize: 9.5,
    lineHeight: 1.8,
  },
  // Footer
  footer: {
    backgroundColor: light,
    borderTopWidth: 1,
    borderTopColor: border,
    paddingVertical: 18,
    paddingHorizontal: 44,
    marginTop: 16,
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  footerContact: {
    color: muted,
    fontSize: 8.5,
    lineHeight: 1.7,
  },
  footerBrand: {
    color: green,
    fontSize: 10,
    fontFamily: 'Helvetica-Bold',
  },
  footerBrandSub: {
    color: muted,
    fontSize: 7.5,
    marginTop: 2,
    textAlign: 'right',
  },
  pageNum: {
    position: 'absolute',
    bottom: 16,
    right: 44,
    color: muted,
    fontSize: 7.5,
  },
})

const OUTPUT_SECTIONS = [
  { key: 'title',                label: 'Presentation Title',              isTitle: true  },
  { key: 'uvp_statement',        label: 'Unique Value Proposition'                        },
  { key: 'landscape',            label: 'Market Landscape: Statistics & Trends'           },
  { key: 'pain1_narrative',      label: 'Pain Point 1'                                    },
  { key: 'pain2_narrative',      label: 'Pain Point 2'                                    },
  { key: 'pain3_narrative',      label: 'Pain Point 3'                                    },
  { key: 'strategy1_narrative',  label: 'Strategy 1'                                      },
  { key: 'strategy2_narrative',  label: 'Strategy 2'                                      },
  { key: 'strategy3_narrative',  label: 'Strategy 3'                                      },
  { key: 'positioning_narrative','label': 'Positioning'                                   },
  { key: 'sponsor_narrative',    label: 'Offer & Call to Action'                          },
]

export default function CoreStoryPDF({ story, intake }) {
  const { businessName = '', ownerName = '', email = '', phone = '', websiteUrl = '', cta = '' } = intake

  return (
    <Document title={`${businessName} — Flip My Business Core Story`} author="Flip My Business by Promptly">
      <Page size="LETTER" style={styles.page}>

        <View style={styles.header}>
          <Text style={styles.headerEyebrow}>Flip My Business · Core Story · by Promptly</Text>
          <Text style={styles.headerBiz}>{businessName}</Text>
          <Text style={styles.headerSub}>
            {websiteUrl ? `${websiteUrl}` : ''}
            {cta ? `  ·  ${cta}` : ''}
          </Text>
        </View>

        {story.stadium_pitch && (
          <View style={styles.pitchWrap}>
            <Text style={styles.pitchLabel}>30-Second Stadium Pitch</Text>
            <Text style={styles.pitchText}>{story.stadium_pitch}</Text>
          </View>
        )}

        <View style={styles.body}>
          {OUTPUT_SECTIONS.map(({ key, label, isTitle }, idx) => {
            if (!story[key]) return null
            const isLast = idx === OUTPUT_SECTIONS.length - 1
            return (
              <View key={key} style={isLast ? styles.sectionLast : styles.section}>
                <Text style={styles.sectionLabel}>{label}</Text>
                {isTitle
                  ? <Text style={styles.sectionTitle}>{story[key]}</Text>
                  : <Text style={styles.sectionBody}>{story[key]}</Text>
                }
              </View>
            )
          })}
        </View>

        <View style={styles.footer}>
          <View style={styles.footerRow}>
            <View>
              {ownerName ? <Text style={styles.footerContact}>{ownerName}</Text> : null}
              {email     ? <Text style={styles.footerContact}>{email}</Text>     : null}
              {phone     ? <Text style={styles.footerContact}>{phone}</Text>     : null}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.footerBrand}>Flip My Business</Text>
              <Text style={styles.footerBrandSub}>by Promptly</Text>
            </View>
          </View>
        </View>

        <Text style={styles.pageNum}
          render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />

      </Page>
    </Document>
  )
}
