import { NextResponse } from "next/server"

import {
  createInvestorProfile,
  createDealInvestor,
  updateDealInvestor,
  isDealmakerConfigured,
  type DealMakerApiError,
  type InvestorType,
  type UtmParams,
} from "@/lib/dealmaker"

// Country dial codes mapping (must match COUNTRIES in step-two-details.tsx)
const COUNTRY_DIAL_CODES: Record<string, string> = {
  US: "+1",
  CA: "+1",
  GB: "+44",
  AU: "+61",
  DE: "+49",
  FR: "+33",
  IT: "+39",
  ES: "+34",
  NL: "+31",
  CH: "+41",
  JP: "+81",
  SG: "+65",
  HK: "+852",
  MX: "+52",
  BR: "+55",
}

/**
 * Convert phone number to E.164 format
 * Input can be: (416) 206-8506, 03-1234-5678 (Japan), etc.
 * Uses the country code to determine the correct dial code prefix
 */
function toE164(phone: string, countryCode = "US"): string {
  // Strip all non-digit characters except leading +
  const hasPlus = phone.startsWith("+")
  const digits = phone.replace(/\D/g, "")
  
  // If already in E.164 format with + and enough digits, return as-is
  if (hasPlus && digits.length >= 7) {
    return `+${digits}`
  }
  
  // Get the dial code for the country
  const dialCode = COUNTRY_DIAL_CODES[countryCode] || "+1"
  const dialDigits = dialCode.replace(/\D/g, "")
  
  // Check if the number already starts with the country dial code
  if (digits.startsWith(dialDigits)) {
    return `+${digits}`
  }
  
  // Remove leading zero if present (common in many countries like UK, Japan, Australia)
  const normalizedDigits = digits.startsWith("0") ? digits.slice(1) : digits
  
  // Add the dial code prefix
  return `${dialCode}${normalizedDigits}`
}

/**
 * POST /api/investor/create
 * Creates a complete investor profile with all details from Step 2.
 * This is called when user completes Step 2 (the details form).
 */
export async function POST(request: Request) {
  if (!isDealmakerConfigured()) {
    return NextResponse.json(
      { error: "DealMaker is not configured. Add API credentials to proceed." },
      { status: 503 }
    )
  }

  const dealId = process.env.DEALMAKER_DEAL_ID!
  const body = await request.json()

  const { 
    email, 
    firstName, 
    lastName, 
    phone, 
    investmentAmount,
    investorType = "individual",
    streetAddress,
    unit,
    city,
    postalCode,
    country,
    state,
    dateOfBirth,
    ssn,
    jointFirstName,
    jointLastName,
    entityName,
    utm_source, 
    utm_medium, 
    utm_campaign, 
    utm_content, 
    utm_term 
  } = body

  if (!email || !investmentAmount || !firstName || !lastName) {
    return NextResponse.json(
      { error: "Email, name, and investment amount are required." },
      { status: 400 }
    )
  }

  try {
    // Build the profile data
    const profileData: Record<string, unknown> = {
      email,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
    }

    // Add phone in E.164 format (required by DealMaker)
    const e164Phone = phone ? toE164(phone, country || "US") : undefined
    if (e164Phone) {
      profileData.phone_number = e164Phone
    }

    // Add address fields per DealMaker OpenAPI spec (createIndividualProfile schema)
    if (streetAddress) {
      profileData.street_address = streetAddress
      profileData.city = city
      profileData.postal_code = postalCode
      profileData.country = country // e.g., "US", "CA" 
      // Only send region if it has a value (some countries don't have states)
      if (state && state.trim()) {
        profileData.region = state // DealMaker uses "region" for state/province
      }
      if (unit) profileData.unit2 = unit // DealMaker uses "unit2" not "unit"
    }

    // Add date of birth in YYYY-MM-DD format (DealMaker required format)
    if (dateOfBirth) {
      const parts = dateOfBirth.split("/")
      if (parts.length === 3) {
        const [month, day, year] = parts
        profileData.date_of_birth = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
      }
    }

    // Add SSN/Tax ID - format based on country
    // CA SIN must be xxx-xxx-xxx, US SSN must be xxx-xx-xxxx, UK NIN is AB123456C
    if (ssn) {
      const digits = ssn.replace(/\D/g, "")
      if (country === "CA" && digits.length === 9) {
        // Canadian SIN format: xxx-xxx-xxx
        profileData.taxpayer_id = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)}`
      } else if (country === "US" && digits.length === 9) {
        // US SSN format: xxx-xx-xxxx
        profileData.taxpayer_id = `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5, 9)}`
      } else if (country === "GB") {
        // UK NIN format: AB123456C (uppercase, no spaces)
        profileData.taxpayer_id = ssn.replace(/\s/g, "").toUpperCase()
      } else if (ssn.trim()) {
        // Other countries: pass as-is
        profileData.taxpayer_id = ssn.trim()
      }
    }

    // Handle type-specific fields
    let type: InvestorType = "individual"
    
    if (investorType === "joint") {
      type = "joint"
      if (jointFirstName) profileData.joint_holder_first_name = jointFirstName
      if (jointLastName) profileData.joint_holder_last_name = jointLastName
    } else if (investorType === "corporation" || investorType === "llc" || investorType === "partnership") {
      type = investorType === "corporation" ? "corporation" : "llc"
      if (entityName) profileData.name = entityName
    } else if (investorType === "trust") {
      type = "trust"
      if (entityName) profileData.name = entityName
    } else if (investorType === "ira") {
      type = "individual" // IRA uses individual profile
    }

    console.log("[v0] Creating investor profile with type:", type)
    console.log("[v0] Profile data:", JSON.stringify(profileData, null, 2))

    // Create the investor profile
    const profile = await createInvestorProfile(type, profileData)

    // Build UTM params
    const utmParams: UtmParams = {}
    if (utm_source) utmParams.utm_source = utm_source
    if (utm_medium) utmParams.utm_medium = utm_medium
    if (utm_campaign) utmParams.utm_campaign = utm_campaign
    if (utm_content) utmParams.utm_content = utm_content
    if (utm_term) utmParams.utm_term = utm_term

    // Create the investor record in the deal
    const investor = await createDealInvestor(dealId, {
      email,
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      phone_number: e164Phone,
      investment_value: investmentAmount,
      allocation_unit: "amount",
      investor_profile_id: profile.id,
    }, utmParams)

    console.log("[v0] Investor created successfully:", investor.id)

    // Explicitly patch the investor to link the profile (some DealMaker setups require this)
    try {
      await updateDealInvestor(dealId, investor.id, {
        investor_profile_id: profile.id,
      })
      console.log("[v0] Investor patched with profile ID:", profile.id)
    } catch (patchError) {
      console.warn("[v0] Failed to patch investor with profile (non-fatal):", patchError)
    }

    return NextResponse.json({
      success: true,
      investorId: investor.id,
      profileId: profile.id,
      subscriptionId: investor.subscription_id,
      state: investor.state,
    })
  } catch (error) {
    console.error("[v0] Failed to create investor:", error)

    const apiErr = error as Partial<DealMakerApiError>
    const status = apiErr.status || 500
    const responseBody = apiErr.responseBody || ""
    
    console.error("[v0] DealMaker API error status:", status)
    console.error("[v0] DealMaker API error body:", responseBody)
    
    let userMessage = "Something went wrong. Please try again."

    if (status === 409) {
      userMessage = "An investor with this email already exists for this deal."
    } else if (status === 422) {
      userMessage = `Invalid data provided. Please check your information and try again. (${responseBody})`
    } else if (status === 400) {
      userMessage = `Bad request. ${responseBody}`
    }

    return NextResponse.json({ error: userMessage }, { status })
  }
}
