"use client";

import {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import api from "../../../utils/api";
import { SocketContext } from "../../../context/SocketContext";
import LoadingSpinner from "../../LoadingSpinner/LoadingSpinner";
import LocationPicker from "../../Common/LocationPicker/LocationPicker";
import "./ManagedServiceBrief.css";

/**
 * ManagedServiceBrief
 * -------------------
 * Shared board for the corporate <-> B2B partner managed-service specification.
 *
 * mode="corporate": the corporate fills in what it needs (work locations & shifts,
 *   route/coverage requests, employee roster with pass months and route hints),
 *   then submits the brief to the partner. Read-only fulfillment progress shown.
 *
 * mode="partner": the partner reads the spec and marks each route/roster item
 *   PENDING / IN_PROGRESS / FULFILLED as they build the real routes, add the
 *   employees and issue passes using the operations tools. Two-way messaging.
 *
 * The endpoints (/api/managed-service-brief/:contractId) enforce access by role
 * and contract ownership, so the same component is safe for both sides.
 */

const DAYS_HINT = "e.g. MON, TUE, WED, THU, FRI";
const emptyBrief = {
  status: "DRAFT",
  summary: "",
  comments: "",
  documents: [],
  serviceStartDate: "",
  sla: { targetCompletionDate: "", fulfillmentSlaHours: 72 },
  pointOfContact: { name: "", phone: "", email: "" },
  partnerResponse: {
    status: "NONE",
    note: "",
    respondedByName: "",
    respondedAt: null,
  },
  workLocations: [],
  routeRequests: [],
  employeeRoster: [],
  messages: [],
};

// Normalize an imported spreadsheet header to a comparable token.
const normKey = (k) =>
  String(k || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");

// Read a value from a row object by trying several possible header tokens.
const pickCell = (row, keys) => {
  for (const k of Object.keys(row)) {
    if (keys.includes(normKey(k))) return row[k];
  }
  return "";
};

// Map a raw spreadsheet row to a brief roster employee.
const rowToRosterEmployee = (row) => ({
  name: String(
    pickCell(row, ["name", "fullname", "employeename"]) || "",
  ).trim(),
  email: String(pickCell(row, ["email", "emailaddress"]) || "").trim(),
  phone: String(
    pickCell(row, [
      "phone",
      "mobile",
      "phonenumber",
      "contact",
      "contactnumber",
    ]) || "",
  ).trim(),
  employeeCode: String(
    pickCell(row, ["employeecode", "code", "empcode", "employeeid", "empid"]) ||
      "",
  ).trim(),
  department: String(pickCell(row, ["department", "dept"]) || "").trim(),
  homeAddress: String(pickCell(row, ["homeaddress", "address"]) || "").trim(),
  pickupArea: String(
    pickCell(row, ["pickuparea", "pickup", "area", "pickuplocation"]) || "",
  ).trim(),
  workLocation: String(
    pickCell(row, ["worklocation", "office", "location"]) || "",
  ).trim(),
  shiftLabel: String(pickCell(row, ["shift", "shiftlabel"]) || "").trim(),
  passMonths:
    Number(pickCell(row, ["passmonths", "months", "pass", "passduration"])) ||
    1,
  preferredRouteLabel: String(
    pickCell(row, ["preferredroute", "route", "preferredroutelabel"]) || "",
  ).trim(),
  assignmentHint: String(
    pickCell(row, ["assignmenthint", "assignment", "note", "notes"]) || "",
  ).trim(),
  fulfillment: { status: "PENDING" },
});

const toArr = (str) =>
  (str || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

const humanFileSize = (bytes) => {
  const n = Number(bytes) || 0;
  if (n <= 0) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(0)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
};

// Format an amount in the contract's own currency. Kuwait uses KWD (3 decimal
// places, the local convention), UAE uses AED, etc. We rely on Intl so the
// right symbol/formatting is shown for whichever GCC market the contract is in.
const formatMoney = (amount, currency = "AED") => {
  const value = Number(amount) || 0;
  try {
    return new Intl.NumberFormat("en", {
      style: "currency",
      currency,
      minimumFractionDigits: currency === "KWD" ? 3 : 2,
      maximumFractionDigits: currency === "KWD" ? 3 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(2)}`;
  }
};

const ManagedServiceBrief = ({
  contractId,
  quotationId,
  mode = "corporate",
}) => {
  const isCorporate = mode === "corporate";

  // The same board serves two stages of the lifecycle:
  //  - QUOTATION stage: the corporate authors the brief and hands it to the
  //    partner BEFORE pricing. There is no fulfilment/approval loop yet — the
  //    partner only reads it to quote accurately.
  //  - CONTRACT stage: once a contract exists the same brief drives the
  //    fulfilment/approval handshake.
  // We pick the API base path and the id we filter socket events against based
  // on which id was supplied.
  const isQuotationStage = Boolean(quotationId);
  const resourceId = quotationId || contractId;
  const basePath = isQuotationStage
    ? `/managed-service-brief/quotation/${quotationId}`
    : `/managed-service-brief/${contractId}`;

  const [brief, setBrief] = useState(emptyBrief);
  const [metrics, setMetrics] = useState(null);
  const [billing, setBilling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState("");
  const [newMessage, setNewMessage] = useState("");
  const rosterFileRef = useRef(null);
  // Requirement-document upload (corporate side, contract-stage board).
  const docFileRef = useRef(null);
  const reviseDocRef = useRef(null);
  const [docUploading, setDocUploading] = useState(false);
  const [revisingDocIndex, setRevisingDocIndex] = useState(null);
  // Map picker state: { kind: "work" | "pickup", index }. null = closed.
  const [picker, setPicker] = useState(null);
  // Partner bulk-create state (contract stage only).
  const [bulkBusy, setBulkBusy] = useState(false);
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false);
  const [assignedVehicles, setAssignedVehicles] = useState([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [selectedVehicleId, setSelectedVehicleId] = useState("");

  const load = useCallback(async () => {
    if (!resourceId) return;
    try {
      setLoading(true);
      const res = await api.get(basePath);
      if (res.data.success) {
        const b = res.data.data.brief;
        setBrief({
          ...emptyBrief,
          ...b,
          serviceStartDate: b.serviceStartDate
            ? new Date(b.serviceStartDate).toISOString().slice(0, 10)
            : "",
          sla: {
            targetCompletionDate: b.sla?.targetCompletionDate
              ? new Date(b.sla.targetCompletionDate).toISOString().slice(0, 10)
              : "",
            fulfillmentSlaHours: b.sla?.fulfillmentSlaHours ?? 72,
          },
          pointOfContact: b.pointOfContact || emptyBrief.pointOfContact,
          partnerResponse: b.partnerResponse || emptyBrief.partnerResponse,
          comments: b.comments || "",
          documents: b.documents || [],
          workLocations: b.workLocations || [],
          routeRequests: b.routeRequests || [],
          employeeRoster: b.employeeRoster || [],
          messages: b.messages || [],
        });
        setMetrics(res.data.data.metrics || null);
        setBilling(res.data.data.billing || null);
      } else {
        setError(res.data.message || "Failed to load service brief.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error loading service brief.");
    } finally {
      setLoading(false);
    }
  }, [basePath, resourceId]);

  useEffect(() => {
    load();
  }, [load]);

  // Live refresh: when the other party fulfils, approves, rejects, submits or
  // messages on this contract's brief, the backend broadcasts
  // `managed_brief_updated`. Refetch so both boards stay in sync without a
  // manual reload.
  const socketCtx = useContext(SocketContext);
  const socket = socketCtx?.socket;
  useEffect(() => {
    if (!socket || !resourceId) return;
    const onUpdate = (payload) => {
      // Match on whichever id identifies the board we're showing. Quotation
      // stage filters on payload.quotationId; contract stage on contractId.
      const matchId = isQuotationStage
        ? payload?.quotationId
        : payload?.contractId;
      if (matchId && matchId !== String(resourceId)) {
        return;
      }
      load();
    };
    socket.on("managed_brief_updated", onUpdate);
    return () => socket.off("managed_brief_updated", onUpdate);
  }, [socket, resourceId, isQuotationStage, load]);

  const progress = useMemo(() => {
    const items = [
      ...(brief.routeRequests || []),
      ...(brief.employeeRoster || []),
    ];
    if (items.length === 0) return { pct: 0, done: 0, total: 0 };
    const done = items.filter(
      (i) => i.fulfillment?.status === "FULFILLED",
    ).length;
    return {
      pct: Math.round((done / items.length) * 100),
      done,
      total: items.length,
    };
  }, [brief.routeRequests, brief.employeeRoster]);

  /* ----------------------------- Corporate edit ---------------------------- */
  const setField = (patch) => setBrief((prev) => ({ ...prev, ...patch }));

  const updateList = (key, index, patch) => {
    setBrief((prev) => {
      const next = [...prev[key]];
      next[index] = { ...next[index], ...patch };
      return { ...prev, [key]: next };
    });
  };

  const addListItem = (key, item) =>
    setBrief((prev) => ({ ...prev, [key]: [...prev[key], item] }));

  const removeListItem = (key, index) =>
    setBrief((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, i) => i !== index),
    }));

  /* ------------------------- map / pickup pinning ------------------------ */
  // Resolve the office point to draw a route to for a given employee: prefer the
  // work location matching emp.workLocation, else the first pinned location.
  const resolveOfficePoint = useCallback(
    (emp) => {
      const locs = brief.workLocations || [];
      const byName = locs.find(
        (l) =>
          l.name &&
          emp?.workLocation &&
          l.name.trim().toLowerCase() === emp.workLocation.trim().toLowerCase(),
      );
      const pick = byName || locs.find((l) => l.location?.lat != null);
      const loc = pick?.location;
      return loc && loc.lat != null && loc.lng != null
        ? { lat: loc.lat, lng: loc.lng }
        : null;
    },
    [brief.workLocations],
  );

  const handlePickerSave = (coords) => {
    if (!picker) return;
    const value = { ...coords, updatedAt: new Date().toISOString() };
    if (picker.kind === "work") {
      updateList("workLocations", picker.index, { location: value });
    } else if (picker.kind === "pickup") {
      updateList("employeeRoster", picker.index, {
        pickupPoint: value,
        // Keep the free-text home address in sync if it was empty.
        homeAddress:
          brief.employeeRoster[picker.index]?.homeAddress ||
          coords.formattedAddress ||
          "",
      });
    }
    setPicker(null);
    setNotice('Location pinned. Click "Save draft" to persist your changes.');
  };

  // Props for the active picker modal.
  const pickerProps = useMemo(() => {
    if (!picker) return null;
    if (picker.kind === "work") {
      const loc = brief.workLocations[picker.index];
      return {
        title: `Pin office: ${loc?.name || "Work location"}`,
        initial: loc?.location?.lat != null ? loc.location : null,
        officePoint: null,
      };
    }
    const emp = brief.employeeRoster[picker.index];
    return {
      title: `Pin pickup: ${emp?.name || "Employee"}`,
      initial: emp?.pickupPoint?.lat != null ? emp.pickupPoint : null,
      officePoint: resolveOfficePoint(emp),
    };
  }, [picker, brief.workLocations, brief.employeeRoster, resolveOfficePoint]);

  const handleSave = async () => {
    try {
      setSaving(true);
      setNotice("");
      const payload = {
        summary: brief.summary,
        comments: brief.comments,
        documents: brief.documents,
        serviceStartDate: brief.serviceStartDate || null,
        sla: {
          targetCompletionDate: brief.sla?.targetCompletionDate || null,
          fulfillmentSlaHours: Number(brief.sla?.fulfillmentSlaHours) || 72,
        },
        pointOfContact: brief.pointOfContact,
        workLocations: brief.workLocations,
        routeRequests: brief.routeRequests,
        employeeRoster: brief.employeeRoster,
      };
      const res = await api.put(basePath, payload);
      if (res.data.success) {
        setNotice("Brief saved.");
        await load();
      } else {
        setError(res.data.message || "Failed to save.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error saving brief.");
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    if (
      !window.confirm(
        "Submit this brief to your B2B partner? They will start setting up routes, employees and passes based on it. You can still edit and re-save afterwards.",
      )
    )
      return;
    try {
      setSaving(true);
      // Save latest edits first, then submit.
      await handleSave();
      const res = await api.post(`${basePath}/submit`);
      if (res.data.success) {
        setNotice("Brief submitted to partner.");
        await load();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error submitting brief.");
    } finally {
      setSaving(false);
    }
  };

  /* --------------------- Partner accept / clarification -------------------- */
  const handleRespond = async (decision) => {
    let note = "";
    if (decision === "REQUEST_CLARIFICATION") {
      note =
        window.prompt(
          "What needs clarification? This message is sent to the corporate client.",
          "",
        ) || "";
      if (!note.trim()) return;
    } else if (
      !window.confirm(
        "Accept this brief? You are agreeing to operate against it, and item fulfillment will be unlocked.",
      )
    ) {
      return;
    }
    try {
      setSaving(true);
      setError(null);
      const res = await api.post(`${basePath}/respond`, { decision, note });
      if (res.data.success) {
        setNotice(res.data.message);
        await load();
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error submitting response.");
    } finally {
      setSaving(false);
    }
  };

  /* -------------------- Requirement document upload ------------------- */
  // Upload requirement files to Cloudinary via the brief upload endpoint, then
  // append/replace them on the brief in local state. The corporate must click
  // "Save draft" afterwards to persist (same pattern as the map pins).
  const uploadBriefDocs = async (files) => {
    const formData = new FormData();
    for (const file of files) formData.append("documents", file);
    const res = await api.post(
      "/managed-service-brief/upload-documents",
      formData,
      { headers: { "Content-Type": "multipart/form-data" } },
    );
    if (!res.data?.success) {
      throw new Error(res.data?.message || "Upload failed.");
    }
    return res.data.data.documents || [];
  };

  const handleAddBriefDocuments = async (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    if (files.length === 0) return;
    try {
      setError(null);
      setDocUploading(true);
      const uploaded = await uploadBriefDocs(files);
      setBrief((prev) => ({
        ...prev,
        documents: [...(prev.documents || []), ...uploaded],
      }));
      setNotice(
        `${uploaded.length} document(s) attached. Click "Save draft" to persist.`,
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not upload the document.",
      );
    } finally {
      setDocUploading(false);
    }
  };

  const handleReviseBriefDocument = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    const index = revisingDocIndex;
    setRevisingDocIndex(null);
    if (!file || index == null) return;
    try {
      setError(null);
      setDocUploading(true);
      const [uploaded] = await uploadBriefDocs([file]);
      if (!uploaded) return;
      setBrief((prev) => {
        const next = [...(prev.documents || [])];
        const prevVersion = Number(next[index]?.version) || 1;
        next[index] = { ...uploaded, version: prevVersion + 1 };
        return { ...prev, documents: next };
      });
      setNotice(
        'Revised version uploaded. Click "Save draft" to persist the change.',
      );
    } catch (err) {
      setError(
        err?.response?.data?.message ||
          err?.message ||
          "Could not upload the revised version.",
      );
    } finally {
      setDocUploading(false);
    }
  };

  const removeBriefDocument = (index) =>
    setBrief((prev) => ({
      ...prev,
      documents: (prev.documents || []).filter((_, i) => i !== index),
    }));

  /* ---------------------- Roster Excel / CSV bulk import ------------------- */
  const handleRosterImport = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      setError(null);
      const xlsxModule = await import("xlsx");
      const XLSX = xlsxModule.default || xlsxModule;
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      const mapped = rows
        .map((r) => rowToRosterEmployee(r))
        .filter((r) => r.name);
      if (mapped.length === 0) {
        setError(
          "No valid rows found. Make sure the file has a 'Name' column and at least one employee row.",
        );
        return;
      }
      setBrief((prev) => ({
        ...prev,
        employeeRoster: [...prev.employeeRoster, ...mapped],
      }));
      setNotice(
        `${mapped.length} employee(s) imported from ${file.name}. Review them below, then click "Save draft" to persist.`,
      );
    } catch (err) {
      console.log("[v0] Roster import error:", err?.message);
      setError(
        "Could not read the file. Please upload a valid .xlsx, .xls or .csv file.",
      );
    } finally {
      e.target.value = "";
    }
  };

  const handleRosterTemplate = async () => {
    try {
      const xlsxModule = await import("xlsx");
      const XLSX = xlsxModule.default || xlsxModule;
      const headers = [
        [
          "Name",
          "Email",
          "Phone",
          "Employee Code",
          "Department",
          "Home Address",
          "Pickup Area",
          "Work Location",
          "Shift",
          "Pass Months",
          "Preferred Route",
          "Assignment Hint",
        ],
      ];
      const example = [
        [
          "John Doe",
          "john@acme.com",
          "+971500000000",
          "EMP001",
          "Engineering",
          "Marina Tower 3, Dubai Marina",
          "Dubai Marina",
          "HQ - Tower B",
          "General",
          3,
          "Marina -> HQ Morning",
          "Window seat preferred",
        ],
      ];
      const ws = XLSX.utils.aoa_to_sheet([...headers, ...example]);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Roster");
      XLSX.writeFile(wb, "employee_roster_template.xlsx");
    } catch (err) {
      console.log("[v0] Roster template error:", err?.message);
      setError("Could not generate the template file.");
    }
  };

  /* ----------------------------- Partner fulfill --------------------------- */
  const handleFulfillment = async (section, itemId, status, note) => {
    try {
      const res = await api.patch(
        `${basePath}/items/${section}/${itemId}/fulfillment`,
        { status, note },
      );
      if (res.data.success) {
        setBrief((prev) => ({
          ...prev,
          ...res.data.data.brief,
          serviceStartDate: prev.serviceStartDate,
          sla: prev.sla,
        }));
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error updating fulfillment.");
    }
  };

  /* --------------------------- Corporate review ---------------------------- */
  const handleReview = async (section, itemId, decision) => {
    let reviewNote = "";
    if (decision === "REJECTED") {
      reviewNote =
        window.prompt(
          "What needs to change? This note is sent to the partner.",
          "",
        ) || "";
    }
    try {
      const res = await api.patch(
        `${basePath}/items/${section}/${itemId}/review`,
        { decision, reviewNote },
      );
      if (res.data.success) {
        setBrief((prev) => ({
          ...prev,
          ...res.data.data.brief,
          serviceStartDate: prev.serviceStartDate,
          sla: prev.sla,
        }));
        if (res.data.data.metrics) setMetrics(res.data.data.metrics);
        setNotice(
          decision === "APPROVED"
            ? "Item approved."
            : "Sent back to partner for rework.",
        );
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error reviewing item.");
    }
  };

  /* ------------------------------- Messaging ------------------------------- */
  const handlePostMessage = async () => {
    if (!newMessage.trim()) return;
    try {
      const res = await api.post(`${basePath}/messages`, {
        message: newMessage.trim(),
      });
      if (res.data.success) {
        setBrief((prev) => ({
          ...prev,
          messages: res.data.data.brief.messages,
        }));
        setNewMessage("");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error posting message.");
    }
  };

  /* ------------------- Partner bulk-create from the brief ------------------ */
  // Map a brief roster "passMonths" number to the durationType the employee
  // bulk-upload / trip generator understands.
  const monthsToDurationType = (months) => {
    switch (Number(months)) {
      case 2:
        return "2_MONTHS";
      case 3:
        return "3_MONTHS";
      case 6:
        return "6_MONTHS";
      case 12:
        return "1_YEAR";
      default:
        return "1_MONTH";
    }
  };

  // Open the vehicle picker: the partner must choose which assigned vehicle the
  // bulk-created routes attach to (an operational route always needs a vehicle).
  const openVehiclePicker = async () => {
    setError(null);
    setVehiclePickerOpen(true);
    try {
      setVehiclesLoading(true);
      const res = await api.get(`/contracts/assigned-vehicles/${contractId}`);
      if (res.data.success) {
        const contract = res.data.data.contract;
        const list = [];
        (contract?.vehicles || []).forEach((group) => {
          (group.assignedVehicles || []).forEach((av) => {
            list.push({
              id: av._id,
              label:
                group.vehicleId?.vehicleName ||
                group.vehicleId?.registrationNumber ||
                "Vehicle",
              registration: group.vehicleId?.registrationNumber || "",
              driverName: av.driverId?.name || null,
            });
          });
        });
        setAssignedVehicles(list);
        if (list.length === 1) setSelectedVehicleId(list[0].id);
      } else {
        setError(res.data.message || "Failed to load vehicles.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error loading vehicles.");
    } finally {
      setVehiclesLoading(false);
    }
  };

  const handleBulkCreateRoutes = async () => {
    if (!selectedVehicleId) {
      setError("Select a vehicle to attach the routes to.");
      return;
    }
    try {
      setBulkBusy(true);
      setError(null);
      const res = await api.post(
        `/contracts/bulk-assign-routes/${contractId}/${selectedVehicleId}`,
      );
      if (res.data.success) {
        const { created = 0, failed = 0 } = res.data.data || {};
        setNotice(
          `Created ${created} route(s) from the brief${failed ? `, ${failed} failed` : ""}. They are linked and marked fulfilled for the client to review.`,
        );
        setVehiclePickerOpen(false);
        setSelectedVehicleId("");
        await load();
      } else {
        setError(res.data.message || "Failed to create routes.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error creating routes.");
    } finally {
      setBulkBusy(false);
    }
  };

  const handleBulkCreateEmployees = async () => {
    const pending = (brief.employeeRoster || []).filter(
      (e) => e.fulfillment?.status !== "FULFILLED" && e.name && e.email,
    );
    if (pending.length === 0) {
      setError(
        "No pending roster employees with both a name and email to create.",
      );
      return;
    }
    if (
      !window.confirm(
        `Create ${pending.length} employee(s) from the brief now? Invitations are NOT sent automatically — you can send them from the Employees & Invitations tab afterwards.`,
      )
    )
      return;
    try {
      setBulkBusy(true);
      setError(null);
      const employees = pending.map((e) => ({
        fullName: e.name,
        email: e.email,
        contactNumber: e.phone,
        employeeId: e.employeeCode || undefined,
        department: e.department || "",
        workLocation: e.workLocation || "",
        pickupLocation: e.pickupArea || "",
        homeAddress: e.homeAddress || "",
        workShift: e.shiftLabel || "",
        passDuration: { durationType: monthsToDurationType(e.passMonths) },
        briefItemId: e._id,
      }));
      const res = await api.post("/corporate-employees/bulk-upload", {
        employees,
        skipInvitation: true,
      });
      if (res.data.success) {
        const s = res.data.data?.summary || {};
        setNotice(
          `Employees processed: ${s.successful || 0} created, ${s.duplicates || 0} already existed, ${s.errors || 0} failed. Send invitations from the Employees & Invitations tab when ready.`,
        );
        await load();
      } else {
        setError(res.data.message || "Failed to create employees.");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error creating employees.");
    } finally {
      setBulkBusy(false);
    }
  };

  /* -------- Shared fulfillment + approval footer for each brief item ------- */
  const renderFulfillmentFooter = (section, item) => {
    // No fulfilment / approval loop exists at quotation stage — the partner is
    // only reading the brief to price it, not operating against it yet.
    if (isQuotationStage) return null;

    const f = item.fulfillment || {};
    const status = f.status || "PENDING";
    const approval = f.approvalStatus || "NONE";

    return (
      <div className="msb-fulfill-controls">
        {/* Partner-side: set fulfillment status (locked until brief accepted) */}
        {!isCorporate && (
          <>
            <span className="msb-spec-label">Mark as</span>
            <select
              value={status}
              disabled={
                brief.status === "SUBMITTED" &&
                brief.partnerResponse?.status !== "ACCEPTED"
              }
              title={
                brief.status === "SUBMITTED" &&
                brief.partnerResponse?.status !== "ACCEPTED"
                  ? "Accept the brief first to unlock fulfillment."
                  : undefined
              }
              onChange={(e) =>
                handleFulfillment(section, item._id, e.target.value)
              }
            >
              <option value="PENDING">Pending</option>
              <option value="IN_PROGRESS">In progress</option>
              <option value="FULFILLED">Fulfilled</option>
            </select>
          </>
        )}

        {/* Approval badge (both sides can see it) */}
        {status === "FULFILLED" && approval !== "NONE" && (
          <span className={`msb-abadge ${approval.toLowerCase()}`}>
            {approval === "PENDING_REVIEW"
              ? "Awaiting review"
              : approval === "APPROVED"
                ? "Approved"
                : "Changes requested"}
          </span>
        )}

        {f.fulfilledByName && (
          <span className="msb-progress-label">by {f.fulfilledByName}</span>
        )}

        {/* Corporate-side: approve / reject a fulfilled item */}
        {isCorporate && status === "FULFILLED" && approval !== "APPROVED" && (
          <span className="msb-review-actions">
            <button
              className="msb-btn primary small"
              onClick={() => handleReview(section, item._id, "APPROVED")}
            >
              Approve
            </button>
            <button
              className="msb-btn danger small"
              onClick={() => handleReview(section, item._id, "REJECTED")}
            >
              Request changes
            </button>
          </span>
        )}

        {/* Corporate review note shown to partner after a rejection */}
        {f.reviewNote && approval === "REJECTED" && (
          <span className="msb-review-note">Note: {f.reviewNote}</span>
        )}
      </div>
    );
  };

  if (loading) {
    return (
      <div className="msb-wrap">
        <LoadingSpinner />
      </div>
    );
  }

  const canEdit = isCorporate && brief.status !== "COMPLETED";

  // The partner may operate (bulk-create routes/employees) once the brief is at
  // contract stage and not still waiting for the partner to accept it.
  const partnerCanOperate =
    !isCorporate &&
    !isQuotationStage &&
    !(
      brief.status === "SUBMITTED" &&
      brief.partnerResponse?.status !== "ACCEPTED"
    );

  const pendingRouteCount = (brief.routeRequests || []).filter(
    (r) => r.fulfillment?.status !== "FULFILLED",
  ).length;
  const pendingEmployeeCount = (brief.employeeRoster || []).filter(
    (e) => e.fulfillment?.status !== "FULFILLED" && e.name && e.email,
  ).length;

  return (
    <div className="msb-wrap">
      <div className="msb-header">
        <div>
          <h2>Managed Service Brief</h2>
          <p className="msb-subtitle">
            {isQuotationStage
              ? isCorporate
                ? "Describe exactly what you need operated — work locations and shifts, the routes you require, and your employee roster with pass durations and route preferences. Submit it so your partner can price the managed service accurately before quoting."
                : "This is what the corporate client needs operated. Review the work locations, routes and employee roster so you can price the managed service accurately before you send your quotation."
              : isCorporate
                ? "Tell your B2B partner exactly what to set up: your work locations and shifts, the routes you need, and your employee roster with pass durations and route preferences. Submit it and the partner will build everything on your behalf."
                : "This is what the corporate client needs you to operate. Build the routes, add the employees and issue the passes using the tabs, then mark each item fulfilled here so the client can track progress."}
          </p>
        </div>
        <span className={`msb-status ${brief.status?.toLowerCase()}`}>
          {(brief.status || "DRAFT").replace(/_/g, " ")}
        </span>
      </div>

      {error && <p className="msb-error">{error}</p>}
      {notice && <div className="msb-note-banner">{notice}</div>}

      {/* Partner acknowledgement handshake (contract stage only) */}
      {!isQuotationStage && !isCorporate && brief.status === "SUBMITTED" && (
        <div className="msb-accept-banner">
          <div className="msb-accept-text">
            <strong>Review &amp; accept this brief</strong>
            <p>
              The client submitted this operations brief. Accept it to begin
              building routes, employees and passes — or request clarification
              if anything is unclear. Item fulfillment stays locked until you
              accept.
            </p>
            {brief.partnerResponse?.status === "CLARIFICATION_REQUESTED" && (
              <p className="msb-accept-warn">
                You requested clarification. Waiting for the client to update
                and re-submit the brief.
              </p>
            )}
          </div>
          <div className="msb-accept-actions">
            <button
              className="msb-btn primary"
              disabled={saving}
              onClick={() => handleRespond("ACCEPT")}
            >
              Accept &amp; start
            </button>
            <button
              className="msb-btn secondary"
              disabled={saving}
              onClick={() => handleRespond("REQUEST_CLARIFICATION")}
            >
              Request clarification
            </button>
          </div>
        </div>
      )}

      {/* Corporate view: partner asked for clarification */}
      {!isQuotationStage &&
        isCorporate &&
        brief.status === "SUBMITTED" &&
        brief.partnerResponse?.status === "CLARIFICATION_REQUESTED" && (
          <div className="msb-accept-banner warn">
            <div className="msb-accept-text">
              <strong>Partner requested clarification</strong>
              <p>
                {brief.partnerResponse.note ||
                  "See the Clarifications thread below."}{" "}
                Update the brief if needed, then re-submit so the partner can
                accept and begin.
              </p>
            </div>
          </div>
        )}

      {/* Both views: brief accepted */}
      {!isQuotationStage &&
        brief.partnerResponse?.status === "ACCEPTED" &&
        (brief.status === "ACCEPTED" || brief.status === "IN_PROGRESS") && (
          <div className="msb-accept-banner ok">
            <span>
              Brief accepted by{" "}
              {brief.partnerResponse.respondedByName || "the partner"}
              {brief.partnerResponse.respondedAt
                ? ` on ${new Date(
                    brief.partnerResponse.respondedAt,
                  ).toLocaleDateString()}`
                : ""}
              . Execution is underway.
            </span>
          </div>
        )}

      {/* Progress (fulfilment only exists once the contract is live) */}
      {!isQuotationStage && (
        <div className="msb-progress">
          <div className="msb-progress-track">
            <div
              className="msb-progress-fill"
              style={{ width: `${progress.pct}%` }}
            />
          </div>
          <div className="msb-progress-label">
            {progress.done} of {progress.total} route &amp; roster items
            fulfilled ({progress.pct}%)
          </div>
        </div>
      )}

      {/* SLA / service-level dashboard */}
      {!isQuotationStage && metrics && metrics.total > 0 && (
        <div className="msb-metrics">
          <div className="msb-metric">
            <span className="msb-metric-value">{metrics.approvalPct}%</span>
            <span className="msb-metric-label">Approved</span>
          </div>
          <div className="msb-metric">
            <span className="msb-metric-value">{metrics.pendingReview}</span>
            <span className="msb-metric-label">Awaiting review</span>
          </div>
          <div className="msb-metric">
            <span className="msb-metric-value">{metrics.onTimePct}%</span>
            <span className="msb-metric-label">On-time (SLA)</span>
          </div>
          <div className={`msb-metric ${metrics.overdue > 0 ? "danger" : ""}`}>
            <span className="msb-metric-value">{metrics.overdue}</span>
            <span className="msb-metric-label">Overdue</span>
          </div>
          <div className="msb-metric">
            <span className="msb-metric-value">{metrics.rejected}</span>
            <span className="msb-metric-label">Reworks</span>
          </div>
        </div>
      )}

      {/* Managed-service billing summary (contract currency: AED/KWD/...) */}
      {billing && billing.totalAmount > 0 && (
        <div className="msb-billing">
          <div className="msb-billing-row">
            <span className="msb-billing-label">Contract value</span>
            <span className="msb-billing-value">
              {formatMoney(billing.totalAmount, billing.currency)}
            </span>
          </div>
          <div className="msb-billing-row">
            <span className="msb-billing-label">
              {isCorporate ? "Management fee" : "Your service charge"}
            </span>
            <span className="msb-billing-value accent">
              {formatMoney(billing.serviceCharge, billing.currency)}
            </span>
          </div>
          <div className="msb-billing-row">
            <span className="msb-billing-label">Operational cost</span>
            <span className="msb-billing-value">
              {formatMoney(billing.operationalAmount, billing.currency)}
            </span>
          </div>
        </div>
      )}

      {/* Overview */}
      <div className="msb-section">
        <div className="msb-section-head">
          <h3>Overview</h3>
        </div>
        {canEdit ? (
          <>
            <div className="msb-field">
              <label>Objectives / summary</label>
              <textarea
                value={brief.summary}
                onChange={(e) => setField({ summary: e.target.value })}
                placeholder="e.g. Daily home-to-office pickup & drop for 40 employees across 3 shifts."
              />
            </div>
            <div className="msb-grid">
              <div className="msb-field">
                <label>Desired service start date</label>
                <input
                  type="date"
                  value={brief.serviceStartDate}
                  onChange={(e) =>
                    setField({ serviceStartDate: e.target.value })
                  }
                />
              </div>
              <div className="msb-field">
                <label>Contact name</label>
                <input
                  value={brief.pointOfContact.name}
                  onChange={(e) =>
                    setField({
                      pointOfContact: {
                        ...brief.pointOfContact,
                        name: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="msb-field">
                <label>Contact phone</label>
                <input
                  value={brief.pointOfContact.phone}
                  onChange={(e) =>
                    setField({
                      pointOfContact: {
                        ...brief.pointOfContact,
                        phone: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="msb-field">
                <label>Contact email</label>
                <input
                  value={brief.pointOfContact.email}
                  onChange={(e) =>
                    setField({
                      pointOfContact: {
                        ...brief.pointOfContact,
                        email: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="msb-field">
                <label>Target go-live date (SLA)</label>
                <input
                  type="date"
                  value={brief.sla?.targetCompletionDate || ""}
                  onChange={(e) =>
                    setField({
                      sla: {
                        ...brief.sla,
                        targetCompletionDate: e.target.value,
                      },
                    })
                  }
                />
              </div>
              <div className="msb-field">
                <label>Per-item SLA (hours)</label>
                <input
                  type="number"
                  min="1"
                  value={brief.sla?.fulfillmentSlaHours ?? 72}
                  onChange={(e) =>
                    setField({
                      sla: {
                        ...brief.sla,
                        fulfillmentSlaHours: Number(e.target.value),
                      },
                    })
                  }
                />
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="msb-spec-row">
              <span className="msb-spec-label">Objectives</span>
              <span className="msb-spec-value">{brief.summary || "—"}</span>
            </div>
            <div className="msb-spec-row">
              <span className="msb-spec-label">Service start</span>
              <span className="msb-spec-value">
                {brief.serviceStartDate || "—"}
              </span>
            </div>
            <div className="msb-spec-row">
              <span className="msb-spec-label">Contact</span>
              <span className="msb-spec-value">
                {brief.pointOfContact?.name || "—"}
                {brief.pointOfContact?.phone
                  ? ` · ${brief.pointOfContact.phone}`
                  : ""}
                {brief.pointOfContact?.email
                  ? ` · ${brief.pointOfContact.email}`
                  : ""}
              </span>
            </div>
          </>
        )}
      </div>

      {/* Requirement documents & comments (customer-supplied requirement) */}
      <div className="msb-section">
        <div className="msb-section-head">
          <h3>Requirement Document(s)</h3>
          {canEdit && (
            <>
              <button
                className="msb-btn primary small"
                onClick={() => docFileRef.current?.click()}
                disabled={docUploading || saving}
              >
                {docUploading ? "Uploading…" : "+ Upload document"}
              </button>
              <input
                ref={docFileRef}
                type="file"
                multiple
                accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp"
                style={{ display: "none" }}
                onChange={handleAddBriefDocuments}
              />
              <input
                ref={reviseDocRef}
                type="file"
                accept=".xlsx,.xls,.csv,.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.webp"
                style={{ display: "none" }}
                onChange={handleReviseBriefDocument}
              />
            </>
          )}
        </div>
        <p className="msb-section-hint">
          The customer&apos;s transportation requirement, uploaded in its own
          format. These files stay attached to the request for future reference.
        </p>
        {(brief.documents || []).length === 0 ? (
          <p className="msb-empty">No requirement documents attached.</p>
        ) : (
          <ul className="msb-doc-list">
            {brief.documents.map((doc, i) => (
              <li
                className="msb-doc-row"
                key={doc._id || doc.publicId || doc.url || i}
              >
                <div className="msb-doc-info">
                  <a
                    href={doc.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="msb-doc-name"
                  >
                    {doc.fileName || "Document"}
                  </a>
                  <span className="msb-doc-meta">
                    {humanFileSize(doc.fileSize)}
                    {doc.version > 1 ? ` · v${doc.version}` : ""}
                    {doc.uploadedByName ? ` · ${doc.uploadedByName}` : ""}
                  </span>
                </div>
                {canEdit && (
                  <div className="msb-doc-actions">
                    <button
                      className="msb-btn secondary small"
                      onClick={() => {
                        setRevisingDocIndex(i);
                        reviseDocRef.current?.click();
                      }}
                      disabled={docUploading || saving}
                    >
                      Upload new version
                    </button>
                    <button
                      className="msb-btn danger small"
                      onClick={() => removeBriefDocument(i)}
                      disabled={docUploading || saving}
                    >
                      Remove
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="msb-section-head" style={{ marginTop: 16 }}>
          <span className="msb-spec-label">Comments &amp; special requirements</span>
        </div>
        {canEdit ? (
          <div className="msb-field">
            <textarea
              value={brief.comments || ""}
              onChange={(e) => setField({ comments: e.target.value })}
              placeholder="e.g. Female drivers preferred on the night shift, wheelchair access required, security passes needed for the site."
            />
          </div>
        ) : (
          <div className="msb-spec-row">
            <span className="msb-spec-value">{brief.comments || "—"}</span>
          </div>
        )}
      </div>

      <p className="msb-section-hint msb-document-source-note">Detailed operational information is maintained in the attached requirement document(s), including routes, locations, shifts, passengers, and vehicle requirements.</p>

      {/* Corporate action buttons */}
      {isCorporate && (
        <div className="msb-actions">
          <button
            className="msb-btn secondary"
            onClick={handleSave}
            disabled={saving || !canEdit}
          >
            {saving ? "Saving…" : "Save draft"}
          </button>
          <button
            className="msb-btn primary"
            onClick={handleSubmit}
            disabled={saving || !canEdit}
          >
            {isQuotationStage
              ? brief.status === "DRAFT"
                ? "Send brief with quotation"
                : "Re-send updated brief"
              : brief.status === "DRAFT"
                ? "Submit to partner"
                : "Re-submit updates"}
          </button>
        </div>
      )}

      {/* Messages */}
      <div className="msb-section" style={{ marginTop: 20 }}>
        <div className="msb-section-head">
          <h3>Clarifications</h3>
        </div>
        <div className="msb-messages">
          {(!brief.messages || brief.messages.length === 0) && (
            <p className="msb-msg-empty">No messages yet.</p>
          )}
          {brief.messages?.map((m, i) => (
            <div
              className={`msb-msg ${m.senderRole?.toLowerCase()}`}
              key={m._id || i}
            >
              <div className="msb-msg-meta">
                {m.senderName || m.senderRole} ·{" "}
                {m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}
              </div>
              {m.message}
            </div>
          ))}
        </div>
        <div className="msb-msg-form">
          <input
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Ask a question or add a clarification…"
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.nativeEvent.isComposing &&
                e.keyCode !== 229
              ) {
                handlePostMessage();
              }
            }}
          />
          <button className="msb-btn primary" onClick={handlePostMessage}>
            Send
          </button>
        </div>
      </div>

      {picker && pickerProps && (
        <LocationPicker
          open
          title={pickerProps.title}
          initial={pickerProps.initial}
          officePoint={pickerProps.officePoint}
          onClose={() => setPicker(null)}
          onSave={handlePickerSave}
        />
      )}

      {/* Partner vehicle picker for bulk route creation */}
      {vehiclePickerOpen && (
        <div
          className="msb-vpicker-overlay"
          onClick={() => !bulkBusy && setVehiclePickerOpen(false)}
        >
          <div className="msb-vpicker" onClick={(e) => e.stopPropagation()}>
            <h3>Create all routes on a vehicle</h3>
            <p className="msb-vpicker-hint">
              Every pending brief route will be created against the vehicle you
              pick and marked fulfilled for the client. You can reassign
              individual routes later from Vehicles &amp; Routes.
            </p>
            {vehiclesLoading ? (
              <p className="msb-empty">Loading assigned vehicles…</p>
            ) : assignedVehicles.length === 0 ? (
              <p className="msb-empty">
                No vehicles are assigned to this contract yet. Assign a vehicle
                first, then create routes from the brief.
              </p>
            ) : (
              <div className="msb-vpicker-list">
                {assignedVehicles.map((v) => (
                  <label
                    key={v.id}
                    className={`msb-vpicker-item ${selectedVehicleId === v.id ? "selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="bulk-vehicle"
                      value={v.id}
                      checked={selectedVehicleId === v.id}
                      onChange={() => setSelectedVehicleId(v.id)}
                    />
                    <span>
                      <strong>{v.label}</strong>
                      {v.registration ? ` · ${v.registration}` : ""}
                      {v.driverName ? ` · Driver: ${v.driverName}` : ""}
                    </span>
                  </label>
                ))}
              </div>
            )}
            <div className="msb-vpicker-actions">
              <button
                className="msb-btn secondary"
                onClick={() => setVehiclePickerOpen(false)}
                disabled={bulkBusy}
              >
                Cancel
              </button>
              <button
                className="msb-btn primary"
                onClick={handleBulkCreateRoutes}
                disabled={bulkBusy || !selectedVehicleId}
              >
                {bulkBusy
                  ? "Creating…"
                  : `Create ${pendingRouteCount} route(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManagedServiceBrief;
