/**
 * CDA / HL7 Clinical Document Parser
 *
 * Decodes and parses base64-encoded clinical document attachments from Apple
 * HealthKit FHIR DocumentReference resources. Apple Health delivers clinical
 * notes as CDA (Clinical Document Architecture) XML — a structured HL7 format
 * used by Epic, Cerner, and most major EHR systems.
 *
 * CDA XML structure:
 *   <ClinicalDocument xmlns="urn:hl7-org:v3">
 *     <component>
 *       <structuredBody>
 *         <component>
 *           <section>
 *             <title>History of Present Illness</title>
 *             <text><paragraph>Patient presents with…</paragraph></text>
 *           </section>
 *         </component>
 *       </structuredBody>
 *     </component>
 *   </ClinicalDocument>
 *
 * The <text> block inside each <section> contains XHTML-like narrative markup
 * (<paragraph>, <list>, <item>, <content>, <br/>) that we strip to plain text.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export interface CdaSection {
  title: string;
  text: string;
}

export type CdaDocType = 'cda' | 'text' | 'pdf' | 'unknown';

export interface CdaParseResult {
  /** What kind of document was detected in the attachment. */
  docType: CdaDocType;
  /** Human-readable sections extracted from CDA structure. Empty for non-CDA. */
  sections: CdaSection[];
  /** Full plain-text summary (sections joined). Empty for binary/unknown. */
  plainText: string;
  /**
   * The decoded string content (XML for CDA, plain text for text/plain).
   * Used for the Firebase Storage upload so we avoid the ArrayBuffer/Blob
   * incompatibility in React Native when uploading raw base64.
   */
  decodedContent: string | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Decode a base64 string to a UTF-8 string.
 * Uses TextDecoder for proper multi-byte character support.
 */
function base64ToUtf8(b64: string): string {
  // atob gives a binary string (one char per byte)
  const binary = atob(b64.trim());
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  try {
    return new TextDecoder('utf-8').decode(bytes);
  } catch {
    // TextDecoder not available — binary string is ASCII-safe for typical CDA
    return binary;
  }
}

/**
 * Returns true if the decoded string looks like a CDA/HL7 XML document.
 */
function isCda(decoded: string): boolean {
  const head = decoded.slice(0, 2000);
  return (
    head.includes('ClinicalDocument') ||
    head.includes('urn:hl7-org:v3') ||
    (head.trimStart().startsWith('<?xml') && head.includes('<section'))
  );
}

/**
 * Strip XML/XHTML tags and decode common HTML entities.
 */
function stripTags(xml: string): string {
  return xml
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(?:paragraph|item|tr|th|td)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Extract all <section> blocks from CDA XML.
 * Each section has a <title> and a <text> element containing the narrative.
 */
function parseCdaSections(xml: string): CdaSection[] {
  const sections: CdaSection[] = [];

  // Match each <section>…</section> block (non-greedy, case-insensitive)
  const sectionPattern = /<section(?:\s[^>]*)?>[\s\S]*?<\/section>/gi;
  const sectionMatches = xml.match(sectionPattern) ?? [];

  for (const block of sectionMatches) {
    // Extract <title>
    const titleMatch = /<title(?:\s[^>]*)?>([^<]*)<\/title>/i.exec(block);
    const title = titleMatch ? titleMatch[1].trim() : '';

    // Extract the narrative <text> block (not <structuredBody> children)
    // We want the first direct <text> inside this section, not nested ones
    const textMatch = /<text(?:\s[^>]*)?>([\s\S]*?)<\/text>/i.exec(block);
    const rawText = textMatch ? textMatch[1] : '';
    const text = stripTags(rawText);

    // Skip sections with no useful content
    if (!text || text.length < 3) continue;

    sections.push({ title: title || 'Clinical Note', text });
  }

  return sections;
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a FHIR attachment from a HealthKit clinical note record.
 *
 * @param base64Data - The raw base64 string from attachment.data
 * @param contentType - MIME type declared in the FHIR attachment
 * @returns Structured parse result with human-readable sections and plain text
 */
export function parseClinicalAttachment(
  base64Data: string,
  contentType: string,
): CdaParseResult {
  // Binary PDF — cannot decode to text on the client
  if (contentType === 'application/pdf') {
    return {
      docType: 'pdf',
      sections: [],
      plainText: '',
      decodedContent: null,
    };
  }

  let decoded: string;
  try {
    decoded = base64ToUtf8(base64Data);
  } catch {
    return { docType: 'unknown', sections: [], plainText: '', decodedContent: null };
  }

  // Plain text
  if (contentType === 'text/plain') {
    return {
      docType: 'text',
      sections: [{ title: 'Clinical Note', text: decoded.trim() }],
      plainText: decoded.trim(),
      decodedContent: decoded,
    };
  }

  // CDA XML (text/xml, application/xml, text/html, or sniffed from content)
  if (isCda(decoded)) {
    const sections = parseCdaSections(decoded);
    const plainText = sections
      .map(s => (s.title ? `${s.title}\n${s.text}` : s.text))
      .join('\n\n');

    return {
      docType: 'cda',
      sections,
      plainText,
      decodedContent: decoded,
    };
  }

  // Unknown — store raw decoded string for best-effort display
  return {
    docType: 'unknown',
    sections: [],
    plainText: decoded.slice(0, 500),
    decodedContent: decoded,
  };
}
