import { useState, useRef, useEffect } from "react"
import { useSelector, useDispatch } from "react-redux"
import { setLocaleCountry } from "../../../Redux/slices/localeSlice"
import { getAllCurrencyOptions } from "../../../config/localeConfig"
import "./AdminCurrencySelector.css"

/**
 * AdminCurrencySelector — lets a platform admin choose which country's currency
 * to view the whole admin dashboard in. It drives the SAME `locale` slice the
 * rest of the app reads from, so selecting a currency updates every admin page
 * (stat cards, finance, reports, charts) consistently. The backend resolves the
 * selected country (admin query-param override) and returns real, country-scoped
 * data in that currency.
 */
function AdminCurrencySelector() {
    const dispatch = useDispatch()
    const locale = useSelector((state) => state.locale)
    const [open, setOpen] = useState(false)
    const [switching, setSwitching] = useState(false)
    const wrapperRef = useRef(null)

    const options = getAllCurrencyOptions()
    const activeCountry = locale?.country || "UAE"
    const current = options.find((o) => o.country === activeCountry) || options[0]

    // Close on outside click
    useEffect(() => {
        const onClick = (e) => {
            if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
                setOpen(false)
            }
        }
        document.addEventListener("mousedown", onClick)
        return () => document.removeEventListener("mousedown", onClick)
    }, [])

    const handleSelect = async (countryCode) => {
        if (countryCode === activeCountry) {
            setOpen(false)
            return
        }
        setSwitching(true)
        try {
            // Updates the main locale slice + hits the backend with the selected
            // country so currency, gateway and payment methods all resolve to it.
            await dispatch(setLocaleCountry(countryCode)).unwrap()
        } catch (err) {
            console.error("[v0] Admin currency switch failed:", err)
        } finally {
            setSwitching(false)
            setOpen(false)
        }
    }

    return (
        <div className="acs-wrapper" ref={wrapperRef}>
            <button
                type="button"
                className="acs-trigger"
                onClick={() => setOpen((v) => !v)}
                disabled={switching}
                aria-haspopup="listbox"
                aria-expanded={open}
                title="Select the currency to view dashboard data in"
            >
                <span className="acs-globe" aria-hidden="true">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="2" y1="12" x2="22" y2="12" />
                        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
                    </svg>
                </span>
                <span className="acs-current">
                    <span className="acs-currency">{current?.currency}</span>
                    <span className="acs-country">{current?.name}</span>
                </span>
                <span className={`acs-caret ${open ? "acs-caret-open" : ""}`} aria-hidden="true">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="6 9 12 15 18 9" />
                    </svg>
                </span>
            </button>

            {open && (
                <ul className="acs-menu" role="listbox">
                    <li className="acs-menu-header">View dashboard currency</li>
                    {options.map((opt) => (
                        <li key={opt.country} role="option" aria-selected={opt.country === activeCountry}>
                            <button
                                type="button"
                                className={`acs-option ${opt.country === activeCountry ? "acs-option-active" : ""}`}
                                onClick={() => handleSelect(opt.country)}
                            >
                                <span className="acs-option-left">
                                    <span className="acs-option-currency">{opt.currency}</span>
                                    <span className="acs-option-country">{opt.name}</span>
                                </span>
                                <span className="acs-option-right">
                                    {!opt.serviceAvailable && (
                                        <span className="acs-soon">Soon</span>
                                    )}
                                    {opt.country === activeCountry && (
                                        <span className="acs-check" aria-hidden="true">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </span>
                                    )}
                                </span>
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    )
}

export default AdminCurrencySelector
