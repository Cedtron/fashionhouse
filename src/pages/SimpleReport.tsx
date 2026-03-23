import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  FiCalendar,
  FiClock,
  FiDownload,
  FiFilter,
  FiMessageCircle,
  FiChevronLeft,
  FiChevronRight,
  FiPackage,
  FiTrendingDown,
  FiTrendingUp,
} from "react-icons/fi";
import api from "../utils/axios";
import PageBreadcrumb from "../components/common/PageBreadCrumb";
import PageMeta from "../components/common/PageMeta";
import PageLoader from "../components/common/PageLoader";

interface StockRecord {
  id: number;
  stockId: string;
  product: string;
  category: string;
}

interface QuantityChange {
  changeType: "increase" | "decrease" | "none";
  changeAmount: number;
  performedAt: string;
  performedBy: string;
  description: string;
  isShadeUpdate: boolean;
  shadeName?: string;
}

interface MovementItem {
  stockId: string;
  product: string;
  category: string;
  stockItem: StockRecord;
  hasShades: boolean;
  quantityChanges: QuantityChange[];
}

interface InventorySummaryResponse {
  items: MovementItem[];
}

interface UserItem {
  id: number;
  role: string;
  username: string;
  phone?: string;
}

type RangeFilter = "day" | "week" | "month" | "year" | "custom-month";

interface ReportRow {
  stockId: string;
  stockRecordId: number;
  product: string;
  category: string;
  added: number;
  reduced: number;
  roll: string;
  date: string;
  performedBy: string;
  description: string;
  rollAffected: number;
}

const monthOptions = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const PAGE_SIZE = 10;

const extractShadeRowsFromDescription = (description: string) => {
  return description
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => /#[0-9a-fA-F]{3,8}/.test(line))
    .map((line) => {
      const colorCodeMatch = line.match(/#[0-9a-fA-F]{3,8}/);

      // Attempt to extract a numeric roll change (e.g. "(+3)", "-2", "(2)")
      const rollChangeMatch = line.match(/\(([+-]?\d+(?:\.\d+)?)\)/) || line.match(/(?:^|[^#\w])([+-]?\d+(?:\.\d+)?)(?![\w])/);

      return {
        colorCode: colorCodeMatch ? colorCodeMatch[0] : "Shade update",
        rollChange: rollChangeMatch ? Math.abs(Number(rollChangeMatch[1])) : 0,
        rawLine: line,
      };
    });
};

const isHexColor = (value: unknown): value is string =>
  typeof value === "string" && /^#[0-9a-fA-F]{3,8}$/.test(value);

const normalizeReportRow = (row: ReportRow): ReportRow => {
  let { added, reduced, roll } = row as any;

  if (isHexColor(added)) {
    roll = added;
    added = 0;
  }

  if (isHexColor(reduced)) {
    roll = reduced;
    reduced = 0;
  }

  return {
    ...row,
    added: Number(added) || 0,
    reduced: Number(reduced) || 0,
    roll,
  };
};

const createExcelExport = (headers: string[], rows: Array<Array<string | number>>, filename: string) => {
  const tableRows = rows
    .map(
      (row) =>
        `<tr>${row
          .map((col) => `<td>${String(col ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`)
          .join("")}</tr>`,
    )
    .join("");

  const html = `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel">
      <head><meta charset="UTF-8" /></head>
      <body>
        <table>
          <thead><tr>${headers.map((header) => `<th>${header}</th>`).join("")}</tr></thead>
          <tbody>${tableRows}</tbody>
        </table>
      </body>
    </html>
  `;

  const blob = new Blob([html], { type: "application/vnd.ms-excel;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(url);
};

const SimpleReport = () => {
  const now = new Date();
  const [summary, setSummary] = useState<InventorySummaryResponse | null>(null);
  const [adminPhone, setAdminPhone] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rangeFilter, setRangeFilter] = useState<RangeFilter>("week");
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [autoWhatsappEnabled, setAutoWhatsappEnabled] = useState(() => localStorage.getItem("simple-report-auto-whatsapp") === "true");
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [summaryRes, usersRes] = await Promise.all([
          api.get("/stock/summary/overview"),
          api.get("/users"),
        ]);

        setSummary(summaryRes.data);

        const users = (usersRes.data || []) as UserItem[];
        const adminUser = users.find((user) => user.role?.toLowerCase() === "admin");
        setAdminPhone(adminUser?.phone || "");
        setError(null);
      } catch (err: any) {
        console.error("Failed to load simple report:", err);
        setError(err?.response?.data?.message || "Failed to load simple report");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const yearOptions = useMemo(() => {
    const years = new Set<number>([now.getFullYear()]);

    summary?.items.forEach((item) => {
      item.quantityChanges.forEach((change) => {
        years.add(new Date(change.performedAt).getFullYear());
      });
    });

    return Array.from(years).sort((a, b) => b - a);
  }, [now, summary]);

  const isDateInRange = (dateValue: string) => {
    const date = new Date(dateValue);
    const today = new Date();
    const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (rangeFilter === "day") {
      return date >= startOfToday;
    }

    if (rangeFilter === "week") {
      const start = new Date(startOfToday);
      start.setDate(start.getDate() - 6);
      return date >= start;
    }

    if (rangeFilter === "month") {
      return date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear();
    }

    if (rangeFilter === "year") {
      return date.getFullYear() === today.getFullYear();
    }

    return date.getMonth() === selectedMonth && date.getFullYear() === selectedYear;
  };

  const reportRows = useMemo<ReportRow[]>(() => {
    if (!summary) return [];

    return summary.items.flatMap((item) =>
      item.quantityChanges
        .filter((change) => change.changeType !== "none" && isDateInRange(change.performedAt))
        .flatMap((change) => {
          if (change.isShadeUpdate) {
            const shadeRows = extractShadeRowsFromDescription(change.description);

            if (shadeRows.length > 0) {
              return shadeRows.map((shadeRow) =>
                normalizeReportRow({
                  stockId: item.stockId,
                  stockRecordId: item.stockItem.id,
                  product: item.product,
                  category: item.category,
                  added: change.changeType === "increase" ? shadeRow.rollChange : 0,
                  reduced: change.changeType === "decrease" ? shadeRow.rollChange : 0,
                  roll: shadeRow.colorCode,
                  date: change.performedAt,
                  performedBy: change.performedBy,
                  description: shadeRow.rawLine,
                  rollAffected: shadeRow.rollChange,
                }),
              );
            }
          }

          return [
            normalizeReportRow({
              stockId: item.stockId,
              stockRecordId: item.stockItem.id,
              product: item.product,
              category: item.category,
              added: change.changeType === "increase" ? change.changeAmount : 0,
              reduced: change.changeType === "decrease" ? change.changeAmount : 0,
              roll: change.isShadeUpdate ? change.shadeName || "Shade update" : "-",
              date: change.performedAt,
              performedBy: change.performedBy,
              description: change.description,
              rollAffected: change.isShadeUpdate ? change.changeAmount : 0,
            }),
          ];
        }),
    ).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [summary, rangeFilter, selectedMonth, selectedYear]);

  const totals = useMemo(() => {
    return reportRows.reduce(
      (acc, row) => {
        acc.totalAdded += row.added;
        acc.totalReduced += row.reduced;
        if (row.roll !== "-") {
          acc.shadeChanges += 1;
        }
        return acc;
      },
      {
        totalAdded: 0,
        totalReduced: 0,
        shadeChanges: 0,
      },
    );
  }, [reportRows]);

  const rangeLabel = useMemo(() => {
    if (rangeFilter === "custom-month") {
      return `${monthOptions[selectedMonth]} ${selectedYear}`;
    }
    return rangeFilter.charAt(0).toUpperCase() + rangeFilter.slice(1);
  }, [rangeFilter, selectedMonth, selectedYear]);

  const whatsappLink = useMemo(() => {
    if (!adminPhone || (rangeFilter !== "week" && rangeFilter !== "month")) {
      return "";
    }

    const normalizedPhone = adminPhone.replace(/[^\d]/g, "");
    if (!normalizedPhone) {
      return "";
    }

    const lines = [
      `Fashion House ${rangeFilter === "week" ? "Weekly" : "Monthly"} Report`,
      `Period: ${rangeLabel}`,
      `Records: ${reportRows.length}`,
      `Total Added: ${totals.totalAdded}`,
      `Total Reduced: ${totals.totalReduced}`,
      `Shade Changes: ${totals.shadeChanges}`,
    ];

    const topRows = reportRows.slice(0, 8).map(
      (row) =>
        `- ${row.product} | +${row.added} | -${row.reduced} | ${row.roll === "-" ? "No shade" : row.roll} | ${new Date(row.date).toLocaleDateString()}`,
    );

    const message = [...lines, "", "Recent activity:", ...topRows].join("\n");
    return `https://wa.me/${normalizedPhone}?text=${encodeURIComponent(message)}`;
  }, [adminPhone, rangeFilter, rangeLabel, reportRows, totals]);

  const totalPages = Math.max(1, Math.ceil(reportRows.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return reportRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, reportRows]);

  useEffect(() => {
    setCurrentPage(1);
  }, [rangeFilter, selectedMonth, selectedYear]);

  useEffect(() => {
    localStorage.setItem("simple-report-auto-whatsapp", String(autoWhatsappEnabled));
  }, [autoWhatsappEnabled]);

  const sendWhatsAppReport = async (message: string) => {
    if (!adminPhone) return;

    try {
      await api.post("/whatsapp/send-report", {
        to: adminPhone,
        message,
      });
    } catch (err: any) {
      console.error("Failed to send WhatsApp report via API:", err?.response?.data || err?.message || err);
    }
  };

  useEffect(() => {
    if (!autoWhatsappEnabled || (rangeFilter !== "week" && rangeFilter !== "month")) {
      return;
    }

    const automationKey = `simple-report-whatsapp:${rangeFilter}:${rangeLabel}:${reportRows.length}`;
    if (sessionStorage.getItem(automationKey) === "sent") {
      return;
    }

    // Automatically send report via backend (WhatsApp Cloud API).
    // This avoids opening a new tab and requires configuration on the server.
    sendWhatsAppReport(
      [
        `Fashion House ${rangeFilter === "week" ? "Weekly" : "Monthly"} Report`,
        `Period: ${rangeLabel}`,
        `Records: ${reportRows.length}`,
        `Total Added: ${totals.totalAdded}`,
        `Total Reduced: ${totals.totalReduced}`,
        `Shade Changes: ${totals.shadeChanges}`,
        "",
        "Recent activity:",
        ...reportRows.slice(0, 8).map(
          (row) =>
            `- ${row.product} | +${row.added} | -${row.reduced} | ${row.roll === "-" ? "No shade" : row.roll} | ${new Date(
              row.date,
            ).toLocaleDateString()}`,
        ),
      ].join("\n"),
    );

    sessionStorage.setItem(automationKey, "sent");
  }, [autoWhatsappEnabled, rangeFilter, rangeLabel, reportRows, totals]);

  const exportToExcel = () => {
    if (!reportRows.length) {
      return;
    }

    createExcelExport(
      ["Product Name", "Category", "Added", "Reduced", "Roll", "Date", "Performed By", "Action Notes"],
      reportRows.map((row) => [
        row.product,
        row.category,
        row.added,
        row.reduced,
        row.roll,
        new Date(row.date).toLocaleString(),
        row.performedBy || "System",
        row.description || "",
      ]),
      `simple-report-${rangeFilter}-${new Date().toISOString().split("T")[0]}.xls`,
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageMeta title="Simple Report" description="Simple stock movement report" />
        <PageBreadcrumb pageTitle="Simple Report" />
        <PageLoader label="Loading simple report..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PageMeta title="Simple Report" description="Simple stock movement report" />
        <PageBreadcrumb pageTitle="Simple Report" />
        <div className="p-6 mt-10 text-center bg-white border border-red-100 rounded-xl shadow-sm max-w-3xl mx-auto">
          <p className="font-semibold text-red-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-gray-50 md:p-6">
      <PageMeta title="Simple Report" description="Simple stock movement report" />
      <PageBreadcrumb pageTitle="Simple Report" />

      <div className="mb-6">
        <h1 className="mb-2 text-2xl font-bold text-gray-800 md:text-3xl">Simple Stock Report</h1>
        <p className="text-gray-600">
          Quick product movement report for daily, weekly, monthly, yearly, or custom month review.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 mb-6 md:grid-cols-2 xl:grid-cols-4">
        <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <p className="text-sm font-medium text-gray-500">Report Range</p>
          <p className="mt-2 text-2xl font-bold text-coffee-700">{rangeLabel}</p>
          <p className="mt-1 text-xs text-gray-400">Current report filter</p>
        </div>
        <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Added</p>
          <p className="mt-2 text-2xl font-bold text-green-600">+{totals.totalAdded}</p>
          <p className="mt-1 text-xs text-gray-400">In selected period</p>
        </div>
        <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <p className="text-sm font-medium text-gray-500">Total Reduced</p>
          <p className="mt-2 text-2xl font-bold text-red-600">-{totals.totalReduced}</p>
          <p className="mt-1 text-xs text-gray-400">In selected period</p>
        </div>
        <div className="p-5 bg-white border border-gray-200 rounded-xl shadow-sm">
          <p className="text-sm font-medium text-gray-500">Shade Changes</p>
          <p className="mt-2 text-2xl font-bold text-blue-600">{totals.shadeChanges}</p>
          <p className="mt-1 text-xs text-gray-400">Color-related updates</p>
        </div>
      </div>

      <div className="p-4 mb-6 bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5 xl:flex xl:flex-wrap">
            <button
              type="button"
              onClick={() => setRangeFilter("day")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${rangeFilter === "day" ? "border-coffee-600 bg-coffee-600 text-white" : "border-gray-200 bg-white text-gray-700"}`}
            >
              Day
            </button>
            <button
              type="button"
              onClick={() => setRangeFilter("week")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${rangeFilter === "week" ? "border-coffee-600 bg-coffee-600 text-white" : "border-gray-200 bg-white text-gray-700"}`}
            >
              Week
            </button>
            <button
              type="button"
              onClick={() => setRangeFilter("month")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${rangeFilter === "month" ? "border-coffee-600 bg-coffee-600 text-white" : "border-gray-200 bg-white text-gray-700"}`}
            >
              Month
            </button>
            <button
              type="button"
              onClick={() => setRangeFilter("year")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${rangeFilter === "year" ? "border-coffee-600 bg-coffee-600 text-white" : "border-gray-200 bg-white text-gray-700"}`}
            >
              Year
            </button>
            <button
              type="button"
              onClick={() => setRangeFilter("custom-month")}
              className={`rounded-lg border px-4 py-2 text-sm font-medium ${rangeFilter === "custom-month" ? "border-coffee-600 bg-coffee-600 text-white" : "border-gray-200 bg-white text-gray-700"}`}
            >
              Month & Year
            </button>
          </div>

          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            {rangeFilter === "custom-month" && (
              <>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-coffee-500"
                >
                  {monthOptions.map((month, index) => (
                    <option key={month} value={index}>
                      {month}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="px-3 py-2 border border-gray-300 rounded-lg outline-none focus:ring-2 focus:ring-coffee-500"
                >
                  {yearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </>
            )}

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <FiFilter />
              Filter report by period
            </div>
          </div>
        </div>
      </div>

      {/* <div className="p-4 mb-6 bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">WhatsApp Report Share</h2>
            <p className="text-sm text-gray-500">
              Weekly and monthly reports can be sent automatically via WhatsApp (backend) or opened manually in WhatsApp.
            </p>
            <p className="mt-1 text-xs text-amber-600">
              Note: the admin phone number must already be on WhatsApp to receive the report.
            </p>
          </div>

          <div className="flex flex-col items-start gap-3">
            <p className="text-sm text-gray-600">
              Admin phone: <span className="font-semibold">{adminPhone || "Not set"}</span>
            </p>
            <label className="flex items-center gap-3 text-sm text-gray-700">
              <span>Auto-send via WhatsApp</span>
              <button
                type="button"
                onClick={() => setAutoWhatsappEnabled((current) => !current)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${autoWhatsappEnabled ? "bg-green-600" : "bg-gray-300"}`}
                aria-pressed={autoWhatsappEnabled}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${autoWhatsappEnabled ? "translate-x-6" : "translate-x-1"}`}
                />
              </button>
            </label>
            <a
              href={whatsappLink || "#"}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium ${whatsappLink ? "bg-green-600 text-white hover:bg-green-700" : "cursor-not-allowed bg-gray-200 text-gray-500"}`}
              onClick={(event) => {
                if (!whatsappLink) {
                  event.preventDefault();
                }
              }}
            >
              <FiMessageCircle />
              Share {rangeFilter === "month" ? "Monthly" : "Weekly"} Report
            </a>
          </div>
        </div>
      </div> */}

      <div className="overflow-hidden bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="flex flex-col gap-2 px-4 py-4 border-b border-gray-200 md:px-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-800">Movement Table</h2>
            <p className="text-sm text-gray-500">
              {reportRows.length} movement record{reportRows.length === 1 ? "" : "s"} in {rangeLabel}
            </p>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-2 text-green-600">
              <FiTrendingUp /> +{totals.totalAdded}
            </span>
            <span className="flex items-center gap-2 text-red-600">
              <FiTrendingDown /> -{totals.totalReduced}
            </span>
            <span className="flex items-center gap-2 text-blue-600">
              <FiPackage /> {totals.shadeChanges} shade updates
            </span>
          </div>
        </div>

        <div className="flex flex-col gap-3 px-4 py-3 border-b border-gray-100 bg-gray-50 md:flex-row md:items-center md:justify-between">
          <p className="text-sm text-gray-500">
            Showing page {currentPage} of {totalPages}. Export always uses all filtered rows, not just the current page.
          </p>
          <button
            type="button"
            onClick={exportToExcel}
            className="inline-flex items-center gap-2 rounded-lg bg-coffee-600 px-4 py-2 text-sm font-medium text-white hover:bg-coffee-700"
          >
            <FiDownload />
            Export Excel
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Product Name</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Category</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase">Added</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-right text-gray-500 uppercase">Reduced</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Roll</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Date</th>
                <th className="px-4 py-3 text-xs font-medium tracking-wider text-left text-gray-500 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {paginatedRows.map((row, index) => (
                <tr key={`${row.stockId}-${row.date}-${index}`} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-800">{row.product}</p>
                      <p className="text-xs text-gray-400">{row.stockId}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{row.category}</td>
                  <td className="px-4 py-3 font-semibold text-right text-green-600">{row.added > 0 ? row.added : "-"}</td>
                  <td className="px-4 py-3 font-semibold text-right text-red-600">{row.reduced > 0 ? row.reduced : "-"}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {isHexColor(row.roll) ? (
                      <span className="inline-flex items-center gap-2">
                        <span
                          className="h-3 w-3 rounded-full border border-gray-200"
                          style={{ backgroundColor: row.roll }}
                        />
                        <span>{row.roll}</span>
                      </span>
                    ) : (
                      row.roll
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-700">
                      <div className="flex items-center gap-2">
                        <FiCalendar className="text-gray-400" />
                        {new Date(row.date).toLocaleDateString()}
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                        <FiClock className="text-gray-400" />
                        {new Date(row.date).toLocaleTimeString()}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-1">
                      <Link
                        to={`/app/${row.stockRecordId}/history`}
                        className="font-medium text-coffee-600 hover:text-coffee-800"
                      >
                        View History
                      </Link>
                      <span className="text-xs text-gray-500">{row.performedBy || "System"}</span>
                    </div>
                  </td>
                </tr>
              ))}
              {reportRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                    No movement records found for the selected period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {reportRows.length > 0 && (
          <div className="flex flex-col gap-3 px-4 py-4 border-t border-gray-100 md:flex-row md:items-center md:justify-between">
            <p className="text-sm text-gray-500">
              Total filtered rows: {reportRows.length}
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <FiChevronLeft />
                Prev
              </button>
              <span className="rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-700">
                {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
                disabled={currentPage === totalPages}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <FiChevronRight />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SimpleReport;
