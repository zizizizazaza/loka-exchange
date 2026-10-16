/** Right column of the KYB steps: what is checked and who keeps the documents. */
export function Aside() {
  return (
    <div className="aside">
      <div className="panel card">
        <h3>What we check</h3>
        <ul className="elig">
          <li>
            <i className="ph ph-buildings"></i>
            <span>
              <b>The company</b>
              <small>Registration against the official registry, status, sanctions lists</small>
            </span>
          </li>
          <li>
            <i className="ph ph-identification-card"></i>
            <span>
              <b>You</b>
              <small>Your ID and a selfie, as the person who acts for the company</small>
            </span>
          </li>
          <li>
            <i className="ph ph-users-three"></i>
            <span>
              <b>Its directors and owners</b>
              <small>Names checked against sanctions lists after you submit. They are asked for ID only if needed</small>
            </span>
          </li>
          <li>
            <i className="ph ph-wallet"></i>
            <span>
              <b>Its addresses</b>
              <small>The wallet you lend from, and where withdrawals go</small>
            </span>
          </li>
        </ul>
      </div>
      <div className="panel card">
        <h3>Your documents</h3>
        <p className="small" style={{ marginTop: 0 }}>
          IDs, selfies and any certificate go to our licensed verification provider. Loka keeps the result and the company details,
          not the images.
        </p>
      </div>
    </div>
  );
}
