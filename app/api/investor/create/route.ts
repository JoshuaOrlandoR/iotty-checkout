import { NextResponse } from "next/server"

import {
  createInvestorProfile,
  createDealInvestor,
  isDealmakerConfigured,
  type DealMakerApiError,
  type InvestorType,
  type UtmParams,
} from "@/lib/dealmaker"

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

    // Add phone
    if (phone) {
      profileData.phone_number = phone
    }

    // Add address fields
    if (streetAddress) {
      profileData.street_address = streetAddress
      if (unit) profileData.unit = unit
      if (city) profileData.city = city
      if (postalCode) profileData.postal_code = postalCode
      if (country) profileData.country = country
      if (state) profileData.region = state // DealMaker uses "region" for state/province
    }

    // Add date of birth (convert from MM/DD/YYYY to ISO format)
    if (dateOfBirth) {
      const parts = dateOfBirth.split("/")
      if (parts.length === 3) {
        const [month, day, year] = parts
        profileData.date_of_birth = `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`
      }
    }

    // Add SSN (US tax ID)
    if (ssn) {
      profileData.us_person = true
      profileData.tax_id = ssn.replace(/-/g, "") // Remove dashes for API
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
      phone,
      investment_value: investmentAmount,
      allocation_unit: "amount",
      investor_profile_id: profile.id,
    }, utmParams)

    console.log("[v0] Investor created successfully:", investor.id)

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
    let userMessage = "Something went wrong. Please try again."

    if (status === 409) {
      userMessage = "An investor with this email already exists for this deal."
    } else if (status === 422) {
      userMessage = "Invalid data provided. Please check your information and try again."
    }

    return NextResponse.json({ error: userMessage }, { status })
  }
}
