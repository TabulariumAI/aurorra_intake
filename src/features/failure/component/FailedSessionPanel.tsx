import { Fragment } from "react";
import { ConfButton, formatLabel, rowStyles } from "aurora-core";
import type { FailedSessionProps } from "../type/failure.types";
import { failureStyles } from "../style/failure.styles";
import { useSourceDownload } from "../hook/useSourceDownload";

export function FailedSessionPanel(props: FailedSessionProps) {
  const { error, choices, sasToken, loading, loadError } = props;
  const { downloading, downloadError, download, link } = useSourceDownload(props);
  const items = choices?.items.filter(item => item.level !== 0);

  return <section aria-label="Failed session information" style={failureStyles.panel}>
    <div style={{ ...rowStyles.failedRow, ...failureStyles.failure }}>
      <strong style={failureStyles.failureTitle}>Failure</strong>
      <p style={failureStyles.message}>{error}</p>
    </div>
    {choices !== null && choices.jurisdiction !== null ? <dl style={failureStyles.details}>
      <dt style={failureStyles.label}>Jurisdiction</dt><dd style={failureStyles.value}>{choices.jurisdiction}</dd>
    </dl> : null}
    {loading ? <p role="status">Loading choices…</p> : null}
    {loadError !== null ? <p role="alert">{loadError}</p> : null}
    {items !== undefined ? <>
      <h3 style={failureStyles.heading}>Indexing choices</h3>
      <div aria-label="Indexing choices table" role="region" tabIndex={0} style={failureStyles.tableFrame}>
      <table aria-label="Indexing choices" style={failureStyles.table}>
        <thead style={failureStyles.tableHead}><tr>{[0, 1].map(pair => <Fragment key={pair}>
          <th scope="col" style={{ ...failureStyles.cell, ...(pair === 1 ? failureStyles.pairStart : {}) }}>Service</th>
          <th scope="col" style={{ ...failureStyles.cell, ...failureStyles.level }}>Value</th>
        </Fragment>)}</tr></thead>
        <tbody>{Array.from({ length: Math.ceil(items.length / 2) }, (_, index) => <tr key={items[index * 2].service}>
          {items.slice(index * 2, index * 2 + 2).map((item, pair) => <Fragment key={item.service}>
            <th scope="row" style={{ ...failureStyles.cell, ...failureStyles.service, ...(pair === 1 ? failureStyles.pairStart : {}) }}>{formatLabel(item.service.replace(/([a-z])([A-Z])/g, "$1 $2"))}</th>
            <td style={{ ...failureStyles.cell, ...failureStyles.level }}>{item.level === 1 ? <span style={failureStyles.enabled}>Yes</span> : item.level}</td>
          </Fragment>)}
          {index * 2 + 1 === items.length ? <><td style={{ ...failureStyles.cell, ...failureStyles.pairStart }} /><td style={failureStyles.cell} /></> : null}
        </tr>)}</tbody>
      </table>
      </div>
      <div style={failureStyles.actions}>
        <ConfButton label={downloading ? "Downloading source…" : "Download source"} disabled={downloading || !choices?.source || sasToken === null}
          requireConfirmation={false} onConfirm={download} variant="primary" />
        <a hidden ref={link} />
      </div>
    </> : null}
    {downloadError !== null ? <p role="alert">{downloadError}</p> : null}
  </section>;
}
