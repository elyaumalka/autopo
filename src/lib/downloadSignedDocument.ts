import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { createRoot } from "react-dom/client";
import { createElement } from "react";
import DocumentContent from "@/components/signing/DocumentContent";

const DOC_LABELS: Record<string, string> = {
  contract: "חוזה השכרה",
  waiver: "כתב ויתור השתתפות עצמית",
  declaration: "תצהיר נהג",
};

export async function downloadSignedDocument(doc: any) {
  // Build off-screen container
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "-10000px";
  container.style.left = "0";
  container.style.width = "800px";
  container.style.background = "white";
  container.style.padding = "32px";
  container.setAttribute("dir", "rtl");
  document.body.appendChild(container);

  const root = createRoot(container);

  await new Promise<void>((resolve) => {
    root.render(
      createElement(
        "div",
        { style: { background: "white", color: "black", fontFamily: "inherit" } },
        createElement(DocumentContent, {
          documentType: doc.document_type,
          details: doc.rental_details || {},
        }),
        doc.signature_data
          ? createElement(
              "div",
              {
                style: {
                  marginTop: "32px",
                  borderTop: "1px solid #ccc",
                  paddingTop: "16px",
                  textAlign: "center" as const,
                },
              },
              createElement(
                "p",
                { style: { fontSize: "13px", fontWeight: 600, marginBottom: "8px" } },
                "חתימת הלקוח:"
              ),
              createElement("img", {
                src: doc.signature_data,
                alt: "חתימה",
                style: { maxWidth: "300px", margin: "0 auto", display: "block" },
              }),
              doc.signed_at
                ? createElement(
                    "p",
                    { style: { fontSize: "11px", color: "#666", marginTop: "8px" } },
                    `נחתם בתאריך: ${new Date(doc.signed_at).toLocaleString("he-IL")}`
                  )
                : null
            )
          : null
      )
    );
    setTimeout(resolve, 300);
  });

  try {
    const canvas = await html2canvas(container, {
      scale: 2,
      backgroundColor: "#ffffff",
      useCORS: true,
    });
    const imgData = canvas.toDataURL("image/png");

    const pdf = new jsPDF("p", "mm", "a4");
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const margin = 5; // שוליים קטנים
    const usableWidth = pageWidth - margin * 2;
    const usableHeight = pageHeight - margin * 2;
    const fullHeight = (canvas.height * usableWidth) / canvas.width;

    if (fullHeight <= usableHeight) {
      // נכנס לעמוד אחד כמו שהוא
      pdf.addImage(imgData, "PNG", margin, margin, usableWidth, fullHeight);
    } else {
      // מקטינים את כל המסמך כך שייכנס לעמוד אחד שלם - בלי לחתוך באמצע
      const scaledHeight = usableHeight;
      const scaledWidth = (canvas.width * scaledHeight) / canvas.height;
      const x = (pageWidth - scaledWidth) / 2;
      pdf.addImage(imgData, "PNG", x, margin, scaledWidth, scaledHeight);
    }

    const label = DOC_LABELS[doc.document_type] || "מסמך";
    const customer = doc.customer_name || "לקוח";
    pdf.save(`${label} - ${customer}.pdf`);
  } finally {
    root.unmount();
    document.body.removeChild(container);
  }
}
