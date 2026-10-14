import type { GeneratePacs009Params } from './types';

/**
 * Builds a valid ISO 20022 pacs.009.001.10 XML document
 */
export function generatePacs009Xml(params: GeneratePacs009Params): string {
  if (params.amountCents <= 0) {
    throw new Error('Settlement amount must be positive');
  }
  if (!params.instructingBic || !params.instructedBic) {
    throw new Error('Instructing and Instructed BICs are required');
  }

  const decimalAmount = (params.amountCents / 100).toFixed(2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.009.001.10">
  <FICdtTrf>
    <GrpHdr>
      <MsgId>SOPHIA-RTGS-${params.endToEndId}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
      <NbOfTxs>1</NbOfTxs>
      <SttlmInf>
        <SttlmMtd>CLRG</SttlmMtd>
      </SttlmInf>
    </GrpHdr>
    <CdtTrfTxInf>
      <PmtId>
        <EndToEndId>${params.endToEndId}</EndToEndId>
        <UETR>${params.uetr}</UETR>
      </PmtId>
      <IntrBkSttlmAmt Ccy="${params.currency}">${decimalAmount}</IntrBkSttlmAmt>
      <IntrBkSttlmDt>${params.settlementDate}</IntrBkSttlmDt>
      <InstgAgt>
        <FinInstnId>
          <BICFI>${params.instructingBic}</BICFI>
        </FinInstnId>
      </InstgAgt>
      <InstdAgt>
        <FinInstnId>
          <BICFI>${params.instructedBic}</BICFI>
        </FinInstnId>
      </InstdAgt>
    </CdtTrfTxInf>
  </FICdtTrf>
</Document>`.trim();
}

/**
 * Builds an ISO 20022 pacs.004.001.11 Payment Return XML document
 */
export function generatePacs004Xml(params: {
  originalEndToEndId: string;
  originalUetr: string;
  returnReasonCode: string;
  amountCents: number;
  currency: string;
  instructingBic: string;
  instructedBic: string;
}): string {
  const decimalAmount = (params.amountCents / 100).toFixed(2);

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pacs.004.001.11">
  <PmtRtr>
    <GrpHdr>
      <MsgId>SOPHIA-RETURN-${params.originalEndToEndId}</MsgId>
      <CreDtTm>${new Date().toISOString()}</CreDtTm>
    </GrpHdr>
    <TxInf>
      <OrgnlEndToEndId>${params.originalEndToEndId}</OrgnlEndToEndId>
      <OrgnlUETR>${params.originalUetr}</OrgnlUETR>
      <RtrdIntrBkSttlmAmt Ccy="${params.currency}">${decimalAmount}</RtrdIntrBkSttlmAmt>
      <RtrRsnInf>
        <Rsn>
          <Cd>${params.returnReasonCode}</Cd>
        </Rsn>
      </RtrRsnInf>
      <InstgAgt>
        <FinInstnId><BICFI>${params.instructingBic}</BICFI></FinInstnId>
      </InstgAgt>
      <InstdAgt>
        <FinInstnId><BICFI>${params.instructedBic}</BICFI></FinInstnId>
      </InstdAgt>
    </TxInf>
  </PmtRtr>
</Document>`.trim();
}
