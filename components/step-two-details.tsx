"use client"

import { useState } from "react"
import { ArrowRight, HelpCircle, User, MapPin, Building, Phone, Calendar, Shield } from "lucide-react"
import { StepTimeline } from "@/components/step-timeline"
import {
  FALLBACK_CONFIG,
  type InvestmentConfig,
} from "@/lib/investment-utils"
import type { ReviewData } from "@/components/step-three-review"

interface StepTwoDetailsProps {
  initialAmount: number
  investorEmail: string
  investorFirstName: string
  investorLastName: string
  investorPhone: string
  onBack: () => void
  onContinue: (data: ReviewData) => void
  config?: InvestmentConfig
}

// DealMaker supported investor types
const INVESTOR_TYPES = [
  { value: "individual", label: "Individual" },
  { value: "joint", label: "Joint" },
  { value: "corporation", label: "Corporation" },
  { value: "trust", label: "Trust" },
  { value: "ira", label: "IRA" },
  { value: "llc", label: "LLC" },
  { value: "partnership", label: "Partnership" },
]

// Country list
const COUNTRIES = [
  { code: "US", name: "United States", dialCode: "+1" },
  { code: "CA", name: "Canada", dialCode: "+1" },
  { code: "GB", name: "United Kingdom", dialCode: "+44" },
  { code: "AU", name: "Australia", dialCode: "+61" },
  { code: "DE", name: "Germany", dialCode: "+49" },
  { code: "FR", name: "France", dialCode: "+33" },
  { code: "IT", name: "Italy", dialCode: "+39" },
  { code: "ES", name: "Spain", dialCode: "+34" },
  { code: "NL", name: "Netherlands", dialCode: "+31" },
  { code: "CH", name: "Switzerland", dialCode: "+41" },
  { code: "JP", name: "Japan", dialCode: "+81" },
  { code: "SG", name: "Singapore", dialCode: "+65" },
  { code: "HK", name: "Hong Kong", dialCode: "+852" },
  { code: "MX", name: "Mexico", dialCode: "+52" },
  { code: "BR", name: "Brazil", dialCode: "+55" },
]

// US States
const US_STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware",
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky",
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi",
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico",
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania",
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont",
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming", "District of Columbia"
]

// Canadian Provinces
const CA_PROVINCES = [
  "Alberta", "British Columbia", "Manitoba", "New Brunswick", "Newfoundland and Labrador",
  "Northwest Territories", "Nova Scotia", "Nunavut", "Ontario", "Prince Edward Island",
  "Quebec", "Saskatchewan", "Yukon"
]

// Validation regex patterns
const VALIDATION_PATTERNS = {
  name: /^[a-zA-Z\s'-]{2,50}$/, // Letters, spaces, apostrophes, hyphens; 2-50 chars
  streetAddress: /^[a-zA-Z0-9\s.,#'-]{5,100}$/, // Alphanumeric with common address characters
  unit: /^[a-zA-Z0-9\s#-]{0,20}$/, // Optional, alphanumeric
  city: /^[a-zA-Z\s'-]{2,50}$/, // Letters, spaces, apostrophes, hyphens
  postalCodeUS: /^\d{5}(-\d{4})?$/, // US ZIP: 12345 or 12345-6789
  postalCodeCA: /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/, // Canadian: A1A 1A1
  postalCodeGeneric: /^[a-zA-Z0-9\s-]{3,10}$/, // Generic postal code
  phone: /^[\d\s()-]{10,20}$/, // Digits with formatting; at least 10 digits
  dateOfBirth: /^(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\/(19|20)\d{2}$/, // MM/DD/YYYY
  entityName: /^[a-zA-Z0-9\s.,&'-]{2,100}$/, // Business/entity names
}

export function StepTwoDetails({ 
  initialAmount, 
  investorEmail, 
  investorFirstName,
  investorLastName,
  investorPhone,
  onBack, 
  onContinue, 
  config = FALLBACK_CONFIG 
}: StepTwoDetailsProps) {
  // Form state - pre-fill from Step 1
  const [investorType, setInvestorType] = useState("individual")
  const [firstName, setFirstName] = useState(investorFirstName)
  const [lastName, setLastName] = useState(investorLastName)
  const [streetAddress, setStreetAddress] = useState("")
  const [unit, setUnit] = useState("")
  const [city, setCity] = useState("")
  const [postalCode, setPostalCode] = useState("")
  const [country, setCountry] = useState("US")
  const [state, setState] = useState("")
  const [phone, setPhone] = useState(() => {
    // Format the incoming phone number if provided
    if (investorPhone) {
      const digits = investorPhone.replace(/\D/g, "").slice(0, 10)
      if (digits.length >= 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
      }
      return investorPhone
    }
    return ""
  })
  const [dateOfBirth, setDateOfBirth] = useState("")
  const [ssn, setSsn] = useState("")
  
  // Type-specific fields
  const [jointFirstName, setJointFirstName] = useState("")
  const [jointLastName, setJointLastName] = useState("")
  const [entityName, setEntityName] = useState("") // For corporation, trust, llc, partnership

  // Validation state
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [touched, setTouched] = useState<Record<string, boolean>>({})
  
  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState("")

  // Get states/provinces based on country
  const getRegions = () => {
    if (country === "US") return US_STATES
    if (country === "CA") return CA_PROVINCES
    return []
  }

  // Get country dial code
  const getDialCode = () => {
    const c = COUNTRIES.find(c => c.code === country)
    return c ? `${c.name} ${c.dialCode}` : country
  }

  // Validate a single field
  const validateField = (field: string, value: string): string => {
    switch (field) {
      case "firstName":
      case "lastName":
        if (!value.trim()) return `${field === "firstName" ? "First" : "Last"} name is required`
        if (!VALIDATION_PATTERNS.name.test(value)) return "Please enter a valid name (letters only, 2-50 characters)"
        return ""
      
      case "jointFirstName":
      case "jointLastName":
        if (!value.trim()) return `Joint holder ${field === "jointFirstName" ? "first" : "last"} name is required`
        if (!VALIDATION_PATTERNS.name.test(value)) return "Please enter a valid name (letters only, 2-50 characters)"
        return ""

      case "entityName":
        if (!value.trim()) return `${investorType === "corporation" ? "Corporation" : investorType === "trust" ? "Trust" : investorType === "llc" ? "LLC" : "Partnership"} name is required`
        if (!VALIDATION_PATTERNS.entityName.test(value)) return "Please enter a valid entity name"
        return ""

      case "streetAddress":
        if (!value.trim()) return "Street address is required"
        if (!VALIDATION_PATTERNS.streetAddress.test(value)) return "Please enter a valid street address"
        return ""

      case "city":
        if (!value.trim()) return "City is required"
        if (!VALIDATION_PATTERNS.city.test(value)) return "Please enter a valid city name"
        return ""

      case "postalCode":
        if (!value.trim()) return "Postal code is required"
        if (country === "US" && !VALIDATION_PATTERNS.postalCodeUS.test(value)) return "Please enter a valid ZIP code (e.g., 12345 or 12345-6789)"
        if (country === "CA" && !VALIDATION_PATTERNS.postalCodeCA.test(value)) return "Please enter a valid postal code (e.g., A1A 1A1)"
        if (country !== "US" && country !== "CA" && !VALIDATION_PATTERNS.postalCodeGeneric.test(value)) return "Please enter a valid postal code"
        return ""

      case "state":
        if ((country === "US" || country === "CA") && !value) return "State/Province is required"
        return ""

      case "phone":
        if (!value.trim()) return "Phone number is required"
        const digitsOnly = value.replace(/\D/g, "")
        if (digitsOnly.length < 10) return "Please enter a valid phone number (at least 10 digits)"
        return ""

      case "dateOfBirth":
        if (!value) return "Date of birth is required"
        if (!VALIDATION_PATTERNS.dateOfBirth.test(value)) return "Please enter a valid date (MM/DD/YYYY)"
        // Additional age validation (must be 18+)
        const [month, day, year] = value.split("/").map(Number)
        const birthDate = new Date(year, month - 1, day)
        const today = new Date()
        const age = today.getFullYear() - birthDate.getFullYear()
        if (age < 18 || (age === 18 && today < new Date(today.getFullYear(), month - 1, day))) {
          return "You must be at least 18 years old to invest"
        }
        return ""

      case "ssn":
        if ((country === "US" || country === "CA") && !value.trim()) {
          return country === "CA" ? "Social Insurance Number is required for Canadian investors" : "Social Security Number is required for US investors"
        }
        if (value) {
          const digits = value.replace(/\D/g, "")
          if (digits.length !== 9) {
            return country === "CA" ? "Please enter a valid SIN (9 digits)" : "Please enter a valid SSN (9 digits)"
          }
        }
        return ""

      default:
        return ""
    }
  }

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {}
    
    // Core fields
    newErrors.firstName = validateField("firstName", firstName)
    newErrors.lastName = validateField("lastName", lastName)
    newErrors.streetAddress = validateField("streetAddress", streetAddress)
    newErrors.city = validateField("city", city)
    newErrors.postalCode = validateField("postalCode", postalCode)
    newErrors.state = validateField("state", state)
    newErrors.phone = validateField("phone", phone)
    newErrors.dateOfBirth = validateField("dateOfBirth", dateOfBirth)
    newErrors.ssn = validateField("ssn", ssn)
    
    // Type-specific validation
    if (investorType === "joint") {
      newErrors.jointFirstName = validateField("jointFirstName", jointFirstName)
      newErrors.jointLastName = validateField("jointLastName", jointLastName)
    }
    if (["corporation", "trust", "llc", "partnership"].includes(investorType)) {
      newErrors.entityName = validateField("entityName", entityName)
    }

    // Filter out empty errors
    const filteredErrors: Record<string, string> = {}
    Object.keys(newErrors).forEach(key => {
      if (newErrors[key]) filteredErrors[key] = newErrors[key]
    })

    setErrors(filteredErrors)
    
    // Mark all fields as touched
    const allTouched: Record<string, boolean> = {}
    Object.keys(newErrors).forEach(key => { allTouched[key] = true })
    setTouched(prev => ({ ...prev, ...allTouched }))
    
    return Object.keys(filteredErrors).length === 0
  }

  const handleContinue = async () => {
    if (!validateForm()) return
    
    setSubmitError("")
    setIsSubmitting(true)

    try {
      // Create the investor profile in DealMaker
      const res = await fetch("/api/investor/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: investorEmail,
          firstName,
          lastName,
          phone,
          investmentAmount: initialAmount,
          investorType,
          streetAddress,
          unit,
          city,
          postalCode,
          country,
          state,
          dateOfBirth,
          ssn,
          ...(investorType === "joint" && { jointFirstName, jointLastName }),
          ...(["corporation", "trust", "llc", "partnership"].includes(investorType) && { entityName }),
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setSubmitError(data.error || "Something went wrong. Please try again.")
        setIsSubmitting(false)
        return
      }

      // Fire dataLayer event
      if (typeof window !== "undefined") {
        (window as Record<string, unknown[]>).dataLayer = (window as Record<string, unknown[]>).dataLayer || []
        ;(window as Record<string, unknown[]>).dataLayer.push({
          event: "investor_profile_created",
          investmentAmount: initialAmount,
          investorType,
          currency: "USD",
        })
      }

      const countryData = COUNTRIES.find(c => c.code === country)
      const reviewData: ReviewData = {
        firstName,
        lastName,
        email: investorEmail,
        phone,
        investorType,
        streetAddress,
        unit,
        city,
        postalCode,
        country: countryData?.name || country,
        countryCode: country,
        state,
        dateOfBirth,
        ssn,
        investmentAmount: initialAmount,
        investorId: data.investorId,
        ...(investorType === "joint" && { jointFirstName, jointLastName }),
        ...(["corporation", "trust", "llc", "partnership"].includes(investorType) && { entityName }),
      }
      onContinue(reviewData)
    } catch {
      setSubmitError("Unable to connect. Please try again.")
      setIsSubmitting(false)
    }
  }

  const handleBlur = (field: string) => {
    setTouched(prev => ({ ...prev, [field]: true }))
    // Validate on blur
    const value = getFieldValue(field)
    const error = validateField(field, value)
    setErrors(prev => ({ ...prev, [field]: error }))
  }

  const getFieldValue = (field: string): string => {
    const fieldMap: Record<string, string> = {
      firstName, lastName, streetAddress, unit, city, postalCode, state, phone, dateOfBirth, ssn,
      jointFirstName, jointLastName, entityName
    }
    return fieldMap[field] || ""
  }

  // Format SSN/SIN input based on country
  // US SSN: XXX-XX-XXXX, Canadian SIN: XXX-XXX-XXX
  const formatTaxId = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 9)
    if (country === "CA") {
      // Canadian SIN format: XXX-XXX-XXX
      if (digits.length <= 3) return digits
      if (digits.length <= 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`
      return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6)}`
    } else {
      // US SSN format: XXX-XX-XXXX
      if (digits.length <= 3) return digits
      if (digits.length <= 5) return `${digits.slice(0, 3)}-${digits.slice(3)}`
      return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`
    }
  }

  // Format DOB input (MM/DD/YYYY)
  const formatDOB = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 8)
    if (digits.length <= 2) return digits
    if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
    return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
  }

  // Format phone input
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10)
    if (digits.length <= 3) return digits
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`
  }

  const inputClass = (field: string) => 
    `w-full pl-10 pr-4 py-3 border rounded-lg text-[#2c3345] text-sm bg-[#f5f7fa] placeholder:text-[#7a8299] focus:outline-none focus:border-[#52b4f9] focus:ring-2 focus:ring-[#52b4f9]/20 transition-all ${
      touched[field] && errors[field] ? "border-[#cb3837]" : "border-[#d1d9e6]"
    }`

  const inputClassNoIcon = (field: string) => 
    `w-full px-4 py-3 border rounded-lg text-[#2c3345] text-sm bg-[#f5f7fa] placeholder:text-[#7a8299] focus:outline-none focus:border-[#52b4f9] focus:ring-2 focus:ring-[#52b4f9]/20 transition-all ${
      touched[field] && errors[field] ? "border-[#cb3837]" : "border-[#d1d9e6]"
    }`

  const selectClass = (field: string) =>
    `w-full px-4 py-3 border rounded-lg text-[#2c3345] text-sm bg-[#f5f7fa] focus:outline-none focus:border-[#52b4f9] focus:ring-2 focus:ring-[#52b4f9]/20 transition-all appearance-none cursor-pointer ${
      touched[field] && errors[field] ? "border-[#cb3837]" : "border-[#d1d9e6]"
    }`

  // Helper to get entity name placeholder
  const getEntityPlaceholder = () => {
    switch (investorType) {
      case "corporation": return "Corporation Name"
      case "trust": return "Trust Name"
      case "llc": return "LLC Name"
      case "partnership": return "Partnership Name"
      default: return "Entity Name"
    }
  }

  // Helper to get signer role label
  const getSignerLabel = () => {
    switch (investorType) {
      case "corporation": return "Signing Officer"
      case "trust": return "Trustee"
      case "llc": return "Managing Member"
      case "partnership": return "General Partner"
      default: return ""
    }
  }

  return (
    <div className="min-h-screen flex items-start justify-center px-3 py-4 md:p-4 md:pt-8 md:pb-8 bg-[#f5f7fa]">
      <div className="w-full max-w-md">
        {/* Main Card */}
        <div className="bg-white rounded-xl border-2 border-[#147bc3] overflow-hidden">
          <div className="p-4 md:p-6">
            {/* Timeline */}
            <StepTimeline currentStep={2} />

            {/* Investor Type */}
            <div className="mb-4 mt-4">
              <div className="flex items-center gap-1 mb-2">
                <label className="text-sm text-[#7a8299]">Who is making the investment?</label>
                <HelpCircle className="w-4 h-4 text-[#7a8299]" />
              </div>
              <div className="relative">
                <select
                  value={investorType}
                  onChange={(e) => {
                    setInvestorType(e.target.value)
                    // Reset type-specific fields
                    setJointFirstName("")
                    setJointLastName("")
                    setEntityName("")
                  }}
                  className={selectClass("investorType")}
                >
                  {INVESTOR_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                  <svg className="w-4 h-4 text-[#7a8299]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </div>

            {/* Entity Name (for corporation, trust, llc, partnership) */}
            {["corporation", "trust", "llc", "partnership"].includes(investorType) && (
              <div className="mb-4">
                <div className="relative">
                  <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a8299]" />
                  <input
                    type="text"
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    onBlur={() => handleBlur("entityName")}
                    placeholder={getEntityPlaceholder()}
                    className={inputClass("entityName")}
                  />
                </div>
                {touched.entityName && errors.entityName && (
                  <p className="text-xs text-[#cb3837] mt-1">{errors.entityName}</p>
                )}
              </div>
            )}

            {/* First Name */}
            <div className="mb-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a8299]" />
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value.replace(/[^a-zA-Z\s'-]/g, ""))}
                  onBlur={() => handleBlur("firstName")}
                  placeholder={getSignerLabel() ? `${getSignerLabel()} First Name` : "First Name"}
                  className={inputClass("firstName")}
                />
              </div>
              {touched.firstName && errors.firstName && (
                <p className="text-xs text-[#cb3837] mt-1">{errors.firstName}</p>
              )}
            </div>

            {/* Last Name */}
            <div className="mb-4">
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a8299]" />
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value.replace(/[^a-zA-Z\s'-]/g, ""))}
                  onBlur={() => handleBlur("lastName")}
                  placeholder={getSignerLabel() ? `${getSignerLabel()} Last Name` : "Last Name"}
                  className={inputClass("lastName")}
                />
              </div>
              {touched.lastName && errors.lastName && (
                <p className="text-xs text-[#cb3837] mt-1">{errors.lastName}</p>
              )}
            </div>

            {/* Joint Holder Fields */}
            {investorType === "joint" && (
              <>
                <div className="mb-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a8299]" />
                    <input
                      type="text"
                      value={jointFirstName}
                      onChange={(e) => setJointFirstName(e.target.value.replace(/[^a-zA-Z\s'-]/g, ""))}
                      onBlur={() => handleBlur("jointFirstName")}
                      placeholder="Joint Holder First Name"
                      className={inputClass("jointFirstName")}
                    />
                  </div>
                  {touched.jointFirstName && errors.jointFirstName && (
                    <p className="text-xs text-[#cb3837] mt-1">{errors.jointFirstName}</p>
                  )}
                </div>
                <div className="mb-4">
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a8299]" />
                    <input
                      type="text"
                      value={jointLastName}
                      onChange={(e) => setJointLastName(e.target.value.replace(/[^a-zA-Z\s'-]/g, ""))}
                      onBlur={() => handleBlur("jointLastName")}
                      placeholder="Joint Holder Last Name"
                      className={inputClass("jointLastName")}
                    />
                  </div>
                  {touched.jointLastName && errors.jointLastName && (
                    <p className="text-xs text-[#cb3837] mt-1">{errors.jointLastName}</p>
                  )}
                </div>
              </>
            )}

            {/* Street Address */}
            <div className="mb-4">
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a8299]" />
                <input
                  type="text"
                  value={streetAddress}
                  onChange={(e) => setStreetAddress(e.target.value)}
                  onBlur={() => handleBlur("streetAddress")}
                  placeholder="Street Address"
                  className={inputClass("streetAddress")}
                />
              </div>
              {touched.streetAddress && errors.streetAddress && (
                <p className="text-xs text-[#cb3837] mt-1">{errors.streetAddress}</p>
              )}
            </div>

            {/* Unit / Apartment / Suite */}
            <div className="mb-4">
              <input
                type="text"
                value={unit}
                onChange={(e) => setUnit(e.target.value)}
                placeholder="Unit / Apartment / Suite"
                className={inputClassNoIcon("unit")}
              />
            </div>

            {/* City */}
            <div className="mb-4">
              <div className="relative">
                <Building className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a8299]" />
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value.replace(/[^a-zA-Z\s'-]/g, ""))}
                  onBlur={() => handleBlur("city")}
                  placeholder="City"
                  className={inputClass("city")}
                />
              </div>
              {touched.city && errors.city && (
                <p className="text-xs text-[#cb3837] mt-1">{errors.city}</p>
              )}
            </div>

            {/* ZIP / Postal Code */}
            <div className="mb-4">
              <input
                type="text"
                value={postalCode}
                onChange={(e) => setPostalCode(e.target.value.toUpperCase())}
                onBlur={() => handleBlur("postalCode")}
                placeholder="ZIP / Postal Code"
                className={inputClassNoIcon("postalCode")}
              />
              {touched.postalCode && errors.postalCode && (
                <p className="text-xs text-[#cb3837] mt-1">{errors.postalCode}</p>
              )}
            </div>

            {/* Country & State Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="text-[0.625rem] text-[#7a8299] mb-1 block uppercase tracking-wide">Country</label>
                <div className="relative">
                  <select
                    value={country}
                    onChange={(e) => {
                      setCountry(e.target.value)
                      setState("") // Reset state when country changes
                    }}
                    className={selectClass("country")}
                  >
                    {COUNTRIES.map(c => (
                      <option key={c.code} value={c.code}>{c.name}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-[#7a8299]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
              </div>
              <div>
                <label className="text-[0.625rem] text-[#7a8299] mb-1 block uppercase tracking-wide">State / Province</label>
                <div className="relative">
                  <select
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    onBlur={() => handleBlur("state")}
                    className={selectClass("state")}
                    disabled={getRegions().length === 0}
                  >
                    <option value="">Select state</option>
                    {getRegions().map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none">
                    <svg className="w-4 h-4 text-[#7a8299]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </div>
                {touched.state && errors.state && (
                  <p className="text-xs text-[#cb3837] mt-1">{errors.state}</p>
                )}
              </div>
            </div>

            {/* Phone with country code */}
            <div className="mb-4">
              <div className="flex">
                <div className="flex items-center gap-1 px-3 py-3 border border-r-0 border-[#d1d9e6] rounded-l-lg bg-[#f5f7fa] text-xs text-[#7a8299] whitespace-nowrap">
                  <span className="hidden sm:inline">{getDialCode()}</span>
                  <span className="sm:hidden">{COUNTRIES.find(c => c.code === country)?.dialCode || "+1"}</span>
                </div>
                <div className="relative flex-1">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a8299]" />
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhone(e.target.value))}
                    onBlur={() => handleBlur("phone")}
                    placeholder="Phone number"
                    className={`w-full pl-10 pr-4 py-3 border rounded-r-lg text-[#2c3345] text-sm bg-[#f5f7fa] placeholder:text-[#7a8299] focus:outline-none focus:border-[#52b4f9] focus:ring-2 focus:ring-[#52b4f9]/20 transition-all ${
                      touched.phone && errors.phone ? "border-[#cb3837]" : "border-[#d1d9e6]"
                    }`}
                  />
                </div>
              </div>
              {touched.phone && errors.phone && (
                <p className="text-xs text-[#cb3837] mt-1">{errors.phone}</p>
              )}
            </div>

            {/* Date of Birth */}
            <div className="mb-4">
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a8299]" />
                <input
                  type="text"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(formatDOB(e.target.value))}
                  onBlur={() => handleBlur("dateOfBirth")}
                  placeholder="Date of Birth (MM/DD/YYYY)"
                  maxLength={10}
                  className={inputClass("dateOfBirth")}
                />
              </div>
              {touched.dateOfBirth && errors.dateOfBirth && (
                <p className="text-xs text-[#cb3837] mt-1">{errors.dateOfBirth}</p>
              )}
            </div>

            {/* Social Security Number / Social Insurance Number */}
            <div className="mb-6">
              <div className="relative">
                <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#7a8299]" />
                <input
                  type="text"
                  value={ssn}
                  onChange={(e) => setSsn(formatTaxId(e.target.value))}
                  onBlur={() => handleBlur("ssn")}
                  placeholder={country === "CA" ? "Social Insurance Number — Required" : "Social Security Number — Required"}
                  maxLength={11}
                  className={inputClass("ssn")}
                />
              </div>
              {touched.ssn && errors.ssn && (
                <p className="text-xs text-[#cb3837] mt-1">{errors.ssn}</p>
              )}
            </div>

            {/* Submit Error */}
            {submitError && (
              <p className="text-[#cb3837] text-sm mb-3">{submitError}</p>
            )}

            {/* Continue Button */}
            <button
              type="button"
              onClick={handleContinue}
              disabled={isSubmitting}
              className="w-full py-3.5 rounded-xl text-base font-semibold bg-[#52b4f9] text-white hover:bg-[#3a9fe0] disabled:bg-[#b8c4d4] disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Creating profile...
                </>
              ) : (
                <>
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            {/* Back link */}
            <button
              type="button"
              onClick={onBack}
              disabled={isSubmitting}
              className="w-full mt-3 py-2 text-sm text-[#7a8299] hover:text-[#2c3345] disabled:opacity-50 transition-colors"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
