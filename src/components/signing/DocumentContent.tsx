interface RentalDetails {
  customer_name?: string;
  customer_id_number?: string;
  customer_phone?: string;
  customer_address?: string;
  vehicle_plate?: string;
  vehicle_manufacturer?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  start_date?: string;
  end_date?: string;
  start_time?: string;
  end_time?: string;
  rental_cost?: number;
  deposit_amount?: number;
  credit_hold?: number;
}

interface DocumentContentProps {
  documentType: string;
  details: RentalDetails;
}

const Field = ({ label, value }: { label: string; value?: string | number | null }) => (
  <span className="inline">
    <strong>{label}: </strong>
    <span className="border-b border-gray-400 px-1 min-w-[80px] inline-block">
      {value || "___________"}
    </span>
  </span>
);

const today = new Date().toLocaleDateString("he-IL");

function ContractContent({ details }: { details: RentalDetails }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <h2 className="text-center text-lg font-bold mb-4">חוזה השכרת רכב</h2>
      <p className="text-left text-xs text-gray-500">תאריך: {today}</p>

      <div className="space-y-2">
        <h3 className="font-bold">פרטי השוכר:</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="שם מלא" value={details.customer_name} />
          <Field label="ת.ז" value={details.customer_id_number} />
          <Field label="טלפון" value={details.customer_phone} />
          <Field label="כתובת" value={details.customer_address} />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold">פרטי הרכב:</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="יצרן" value={details.vehicle_manufacturer} />
          <Field label="דגם" value={details.vehicle_model} />
          <Field label="שנה" value={details.vehicle_year} />
          <Field label="צבע" value={details.vehicle_color} />
          <Field label="מספר רישוי" value={details.vehicle_plate} />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold">תקופת ההשכרה:</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="מתאריך" value={details.start_date} />
          <Field label="שעה" value={details.start_time} />
          <Field label="עד תאריך" value={details.end_date} />
          <Field label="שעה" value={details.end_time} />
        </div>
      </div>

      <div className="space-y-2">
        <h3 className="font-bold">תנאים כספיים:</h3>
        <div className="grid grid-cols-2 gap-2">
          <Field label="עלות השכרה" value={details.rental_cost ? `₪${details.rental_cost}` : undefined} />
          <Field label="פיקדון" value={details.deposit_amount ? `₪${details.deposit_amount}` : undefined} />
          <Field label="הקפאת אשראי" value={details.credit_hold ? `₪${details.credit_hold}` : undefined} />
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <h3 className="font-bold text-sm">תנאי החוזה:</h3>
        <p>1. השוכר מתחייב להשתמש ברכב בזהירות ובהתאם לחוק ולשמור עליו כשומר שכר.</p>
        <p>2. השוכר אחראי לכל נזק שייגרם לרכב במהלך תקופת ההשכרה, למעט בלאי סביר.</p>
        <p>3. השוכר מתחייב להחזיר את הרכב במועד הנקוב ובמצב תקין, כולל ניקיון ודלק מלא.</p>
        <p>4. איחור בהחזרת הרכב יחויב בתעריף שעתי לפי המחירון.</p>
        <p>5. אין להעביר את הרכב לשימוש של אדם אחר ללא אישור בכתב מהמשכיר.</p>
        <p>6. השוכר מתחייב לדווח על כל תאונה או נזק באופן מיידי למשכיר.</p>
        <p>7. השוכר מצהיר כי בדק את הרכב וקיבל אותו במצב תקין ושלם.</p>
        <p>8. השוכר אחראי לכל דוחות תנועה וחניה שיירשמו בתקופת ההשכרה.</p>
        <p>9. המשכיר רשאי לבטל את ההשכרה באופן מיידי אם השוכר מפר את תנאי החוזה.</p>
        <p>10. כל סכסוך בין הצדדים יידון בבית המשפט המוסמך באזור מקום מגורי המשכיר.</p>
      </div>

      <p className="text-xs mt-4">
        אני, <strong>{details.customer_name || "___________"}</strong>, מאשר/ת כי קראתי את תנאי החוזה ואני מסכים/ה לכל התנאים המפורטים לעיל.
      </p>
    </div>
  );
}

function WaiverContent({ details }: { details: RentalDetails }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <h2 className="text-center text-lg font-bold mb-4">כתב ויתור על השתתפות עצמית</h2>
      <p className="text-left text-xs text-gray-500">תאריך: {today}</p>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="שם השוכר" value={details.customer_name} />
          <Field label="ת.ז" value={details.customer_id_number} />
          <Field label="רכב" value={`${details.vehicle_manufacturer || ""} ${details.vehicle_model || ""}`} />
          <Field label="מספר רישוי" value={details.vehicle_plate} />
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <p>
          אני הח"מ, <strong>{details.customer_name || "___________"}</strong>, מספר זהות{" "}
          <strong>{details.customer_id_number || "___________"}</strong>, מצהיר/ה ומאשר/ת בזאת כדלקמן:
        </p>
        <p>1. הנני מוותר/ת על ביטוח השתתפות עצמית ברכב שפרטיו מצוינים לעיל.</p>
        <p>2. ידוע לי כי ויתור על ביטוח ההשתתפות העצמית מחייב אותי לשאת בכל עלות נזק שייגרם לרכב במהלך תקופת ההשכרה.</p>
        <p>3. ידוע לי כי גובה ההשתתפות העצמית עלול להגיע לסכומים משמעותיים, בהתאם לחומרת הנזק.</p>
        <p>4. הנני מאשר/ת כי הוצעה לי אפשרות לרכוש ביטוח השתתפות עצמית ובחרתי לוותר עליה מרצוני החופשי.</p>
        <p>5. הנני מתחייב/ת לשלם את מלוא עלות הנזק לרכב, ככל שייגרם, לרבות ימי השבתה.</p>
      </div>

      <p className="text-xs mt-4">
        אני מאשר/ת כי קראתי והבנתי את תוכן כתב הוויתור וחתמתי עליו מרצוני החופשי.
      </p>
    </div>
  );
}

function DeclarationContent({ details }: { details: RentalDetails }) {
  return (
    <div className="space-y-4 text-sm leading-relaxed">
      <h2 className="text-center text-lg font-bold mb-4">תצהיר נהג</h2>
      <p className="text-left text-xs text-gray-500">תאריך: {today}</p>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="שם הנהג" value={details.customer_name} />
          <Field label="ת.ז" value={details.customer_id_number} />
          <Field label="טלפון" value={details.customer_phone} />
          <Field label="כתובת" value={details.customer_address} />
        </div>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Field label="רכב" value={`${details.vehicle_manufacturer || ""} ${details.vehicle_model || ""} ${details.vehicle_year || ""}`} />
          <Field label="מספר רישוי" value={details.vehicle_plate} />
          <Field label="מתאריך" value={details.start_date} />
          <Field label="עד תאריך" value={details.end_date} />
        </div>
      </div>

      <div className="space-y-2 text-xs">
        <p>אני הח"מ מצהיר/ה בזאת כי:</p>
        <p>1. הנני בעל/ת רישיון נהיגה בתוקף המתאים לסוג הרכב המושכר.</p>
        <p>2. לא נשלל ממני רישיון הנהיגה ולא הוטלה עליי כל הגבלה על נהיגה.</p>
        <p>3. אני במצב בריאותי תקין ואין כל מניעה רפואית מלנהוג ברכב.</p>
        <p>4. ידוע לי כי אני הנהג/ת היחיד/ה המורשה לנהוג ברכב, אלא אם אושר אחרת בכתב.</p>
        <p>5. אני מתחייב/ת שלא לנהוג תחת השפעת אלכוהול, סמים או תרופות הפוגעות בכושר הנהיגה.</p>
        <p>6. אני מתחייב/ת לציית לכל חוקי התעבורה ולנהוג בזהירות.</p>
        <p>7. ידוע לי כי כל דוח תנועה שיירשם בתקופת ההשכרה יועבר על שמי.</p>
        <p>8. אני מתחייב/ת לדווח על כל אירוע חריג, תאונה או תקלה באופן מיידי.</p>
      </div>

      <p className="text-xs mt-4">
        אני, <strong>{details.customer_name || "___________"}</strong>, מצהיר/ה כי כל הפרטים שמסרתי נכונים ומדויקים, וחתימתי מטה מאשרת את הצהרתי.
      </p>
    </div>
  );
}

export default function DocumentContent({ documentType, details }: DocumentContentProps) {
  switch (documentType) {
    case "contract":
      return <ContractContent details={details} />;
    case "waiver":
      return <WaiverContent details={details} />;
    case "declaration":
      return <DeclarationContent details={details} />;
    default:
      return <p className="text-center text-gray-500">סוג מסמך לא מוכר</p>;
  }
}
