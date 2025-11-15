import { toErrorResponse } from "@/lib/errors";
import { createSupabaseServiceRoleClient } from "@/lib/supabaseServer";
import { requireUser } from "@/lib/auth";

export async function GET() {
  try {
    const user = await requireUser();

    const supabase = createSupabaseServiceRoleClient();

    // Get all meetings where user participated (as host or participant)
    const { data: participations, error: participationsError } = await supabase
      .from("meeting_participants")
      .select(
        `
        *,
        meetings (
          id,
          title,
          description,
          status,
          created_at,
          ended_at,
          host_id
        )
      `
      )
      .eq("user_id", user.id)
      .order("joined_at", { ascending: false });

    if (participationsError) {
      throw participationsError;
    }

    // Also get meetings where user is host but hasn't joined yet (created but not participated)
    const { data: hostedMeetings, error: hostedError } = await supabase
      .from("meetings")
      .select("*")
      .eq("host_id", user.id)
      .order("created_at", { ascending: false });

    if (hostedError) {
      throw hostedError;
    }

    // Get all unique meeting IDs from participations
    const participationMeetingIds = new Set(
      participations?.map((p) => p.meeting_id) || []
    );

    // Get meeting details for all participations
    // Group by meeting_id and keep only the most recent participation for each meeting
    const participationMap = new Map<string, {
      meeting: {
        id: string;
        title: string;
        description?: string | null;
        status: string;
        created_at: string;
        ended_at?: string | null;
        host_id: string;
      };
      role: "host" | "participant";
      display_name: string | null;
      joined_at: string;
      left_at: string | null;
    }>();

    participations?.forEach((p) => {
      const meeting = p.meetings as {
        id: string;
        title: string;
        description?: string | null;
        status: string;
        created_at: string;
        ended_at?: string | null;
        host_id: string;
      };
      
      const meetingId = meeting.id;
      const existing = participationMap.get(meetingId);
      
      // If this meeting is not in map, add it
      // If it exists, replace only if this participation is more recent (joined_at is later)
      if (!existing || new Date(p.joined_at).getTime() > new Date(existing.joined_at).getTime()) {
        participationMap.set(meetingId, {
          meeting: {
            id: meeting.id,
            title: meeting.title,
            description: meeting.description,
            status: meeting.status,
            created_at: meeting.created_at,
            ended_at: meeting.ended_at,
            host_id: meeting.host_id,
          },
          role: p.role,
          display_name: p.display_name,
          joined_at: p.joined_at,
          left_at: p.left_at,
        });
      }
    });

    const participationMeetings = Array.from(participationMap.values());

    // Add meetings where user is host but hasn't joined yet (created but not participated)
    const hostedMeetingsNotJoined = hostedMeetings
      ?.filter((meeting) => !participationMeetingIds.has(meeting.id))
      .map((meeting) => ({
        meeting: {
          id: meeting.id,
          title: meeting.title,
          description: meeting.description,
          status: meeting.status,
          created_at: meeting.created_at,
          ended_at: meeting.ended_at,
          host_id: meeting.host_id,
        },
        role: "host" as const,
        display_name: null,
        joined_at: meeting.created_at,
        left_at: null,
      })) || [];

    // Combine all meetings
    const allMeetings = [...participationMeetings, ...hostedMeetingsNotJoined];

    // Sort by joined_at or created_at (most recent first)
    allMeetings.sort((a, b) => {
      const aDate = new Date(a.joined_at).getTime();
      const bDate = new Date(b.joined_at).getTime();
      return bDate - aDate;
    });

    return Response.json({
      ok: true,
      meetings: allMeetings,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}

