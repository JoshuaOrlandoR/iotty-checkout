import { NextResponse } from "next/server"

import {
  createInvestorProfile,
  updateDealInvestor,
  getInvestorAccessLink,
  isDealmakerConfigured,
  type DealMakerApiError,
  type InvestorType,
} from "@/lib/dealmaker"

/**
 * POST /api/investor/complete
 * Completes an existing investor record with profile info (Step 2).
 * Creates the proper investor profile and links it to the investor.
 */
export async function POST(request: Request) {
  if (!isDealmakerConfigured()) {
    return NextResponse.json(
      { error: "DealMaker is not configured." },
      { status: 503 }
    )
  }

  const dealId = process.env.DEALMAKER_DEAL_ID!
  const body = await request.json()

  const { 
    investorId: rawInvestorId, 
    email, 
    firstName, 
    lastName, 
    phoneNumber, 
    investorType, 
    jointFirstName, 
    jointLastName, 
    corporationName, 
    trustName,
    streetAddress,
    unit,
    city,
    postalCode,
    country,
    state,
    dateOfBirth,
    ssn
  } = body

  if (!rawInvestorId || !email || !firstName || !lastName) {
    return NextResponse.json(
      { error: "Missing required fields." },
      { status: 400 }
    )
  }

  // Ensure investorId is a number
  const investorId = typeof rawInvestorId === "string" ? parseInt(rawInvestorId, 10) : rawInvestorId

  try {
    // Build the proper profile based on investor type
    const type: InvestorType = investorType || "individual"
    let profileData: Record<string, unknown> = { email }

    // Add phone number if provided
    if (phoneNumber) {
      profileData.phone_number = phoneNumber
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

    switch (type) {
      case "individual":
        profileData.first_name = firstName
        profileData.last_name = lastName
        break
      case "joint":
        profileData.first_name = firstName
        profileData.last_name = lastName
        profileData.joint_holder_first_name = jointFirstName || ""
        profileData.joint_holder_last_name = jointLastName || ""
        break
      case "corporation":
        profileData.name = corporationName || ""
        profileData.signing_officer_first_name = firstName
        profileData.signing_officer_last_name = lastName
        break
      case "trust":
        profileData.name = trustName || ""
        profileData.trustees = [{ first_name: firstName, last_name: lastName }]
        break
      default:
        profileData.first_name = firstName
        profileData.last_name = lastName
    }

    // Create the proper profile
    const profile = await createInvestorProfile(type, profileData)

    // Update the investor with the new profile
    const updated = await updateDealInvestor(dealId, investorId, {
      investor_profile_id: profile.id,
    })

    // Get access link for redirect
    let paymentUrl: string | null = null
    try {
      const accessLink = await getInvestorAccessLink(dealId, investorId)
      paymentUrl = accessLink.access_link || null
    } catch {
      console.error("Failed to get access link")
    }

    return NextResponse.json({
      investorId: updated.id,
      state: updated.state,
      paymentUrl,
    })
  } catch (error) {
    console.error("Failed to complete investor:", error)

    const apiErr = error as Partial<DealMakerApiError>
    const status = apiErr.status || 500
    let userMessage = "Something went wrong. Please try again."

    if (apiErr.responseBody) {
      try {
        const parsed = JSON.parse(apiErr.responseBody)
        if (parsed.error) userMessage = parsed.error
        else if (parsed.message) userMessage = parsed.message
      } catch {}
    }

    return NextResponse.json({ error: userMessage }, { status })
  }
}
