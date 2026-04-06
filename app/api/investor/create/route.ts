import { NextResponse } from "next/server"

import {
  createInvestorProfile,
  createDealInvestor,
  searchDealInvestors,
  getInvestorAccessLink,
  isDealmakerConfigured,
  type DealMakerApiError,
  type DealInvestor,
  type UtmParams,
} from "@/lib/dealmaker"

/**
 * POST /api/investor/create
 * Creates a minimal investor record early in the flow (email + amount only).
 * Returns investorId for subsequent updates, or existing investments for resume.
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

  const { email, firstName, lastName, phone, investmentAmount, forceCreate, utm_source, utm_medium, utm_campaign, utm_content, utm_term } = body

  if (!email || !investmentAmount) {
    return NextResponse.json(
      { error: "Email and investment amount are required." },
      { status: 400 }
    )
  }

  // Use provided names or fallback to placeholder
  const first_name = firstName?.trim() || "Pending"
  const last_name = lastName?.trim() || "Investor"

  try {
    // Check for existing investors with this email first (unless forceCreate is true)
    if (!forceCreate) {
      const rawInvestors = await searchDealInvestors(dealId, email)
      const raw = rawInvestors as DealInvestor[] | { items?: DealInvestor[]; data?: DealInvestor[] }
      const existingInvestors: DealInvestor[] = Array.isArray(raw) ? raw : (raw.items || raw.data || [])

      // Find resumable investors
      const resumableStates = ["invited", "signed", "waiting"]
      const resumable = existingInvestors
        .filter((inv) => inv.state && resumableStates.includes(inv.state.toLowerCase()))
        .sort((a, b) => Number(b.id) - Number(a.id))

      if (resumable.length > 0) {
        // Return existing investments for user to choose
        const investments = resumable.map((inv) => ({
          id: inv.id,
          state: inv.state,
          amount: inv.investment_value,
          shares: inv.number_of_securities,
        }))

        return NextResponse.json({
          existingInvestments: true,
          investments,
        })
      }
    }

    // No existing investors - create a new one with the provided info
    // Create individual profile with the name from Step 1 (will be updated/replaced in Step 2 with full details)
    const profile = await createInvestorProfile("individual", {
      email,
      first_name,
      last_name,
      phone,
    })

    // Build UTM params
    const utmParams: UtmParams = {}
    if (utm_source) utmParams.utm_source = utm_source
    if (utm_medium) utmParams.utm_medium = utm_medium
    if (utm_campaign) utmParams.utm_campaign = utm_campaign
    if (utm_content) utmParams.utm_content = utm_content
    if (utm_term) utmParams.utm_term = utm_term

    // Create the investor record
    const investor = await createDealInvestor(dealId, {
      email,
      first_name,
      last_name,
      phone,
      investment_value: investmentAmount,
      allocation_unit: "amount",
      investor_profile_id: profile.id,
    }, utmParams)

    return NextResponse.json({
      existingInvestments: false,
      investorId: investor.id,
      profileId: profile.id,
      subscriptionId: investor.subscription_id,
      state: investor.state,
    })
  } catch (error) {
    console.error("Failed to create early investor:", error)

    const apiErr = error as Partial<DealMakerApiError>
    const status = apiErr.status || 500
    let userMessage = "Something went wrong. Please try again."

    if (status === 409) {
      userMessage = "An investor with this email already exists."
    } else if (status === 422) {
      userMessage = "Invalid email or amount. Please check and try again."
    }

    return NextResponse.json({ error: userMessage }, { status })
  }
}
