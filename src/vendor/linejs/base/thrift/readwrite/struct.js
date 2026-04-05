import * as LINETypes from "../../../../linejs-types/line_types.js";
function map(call, value) {
  const tMap = {};
  for(const key in value){
    const e = value[key];
    tMap[key] = call(e);
  }
  return tMap;
}
export function AcceptChatInvitationByTicketRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.chatMid
    ],
    [
      11,
      3,
      param.ticketId
    ]
  ];
}
export function AcceptChatInvitationRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.chatMid
    ]
  ];
}
export function AcceptSpeakersRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      14,
      3,
      [
        11,
        param.targetMids
      ]
    ]
  ];
}
export function AcceptToChangeRoleRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      11,
      3,
      param.inviteRequestId
    ]
  ];
}
export function AcceptToListenRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      11,
      3,
      param.inviteRequestId
    ]
  ];
}
export function AcceptToSpeakRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      11,
      3,
      param.inviteRequestId
    ]
  ];
}
export function LiveTalkType(param) {
  return typeof param === "string" ? LINETypes.enums.LiveTalkType[param] : param;
}
export function LiveTalkSpeakerSetting(param) {
  return typeof param === "string" ? LINETypes.enums.LiveTalkSpeakerSetting[param] : param;
}
export function AcquireLiveTalkRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.title
    ],
    [
      8,
      3,
      LiveTalkType(param.type)
    ],
    [
      8,
      4,
      LiveTalkSpeakerSetting(param.speakerSetting)
    ]
  ];
}
export function CancelToSpeakRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ]
  ];
}
export function FetchLiveTalkEventsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      11,
      3,
      param.syncToken
    ],
    [
      8,
      4,
      param.limit
    ]
  ];
}
export function FindLiveTalkByInvitationTicketRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.invitationTicket
    ]
  ];
}
export function ForceEndLiveTalkRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ]
  ];
}
export function GetLiveTalkInfoForNonMemberRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      15,
      3,
      [
        11,
        param.speakers
      ]
    ]
  ];
}
export function GetLiveTalkInvitationUrlRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ]
  ];
}
export function GetLiveTalkSpeakersForNonMemberRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      15,
      3,
      [
        11,
        param.speakers
      ]
    ]
  ];
}
export function GetSquareInfoByChatMidRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ]
  ];
}
export function LiveTalkRole(param) {
  return typeof param === "string" ? LINETypes.enums.LiveTalkRole[param] : param;
}
export function InviteToChangeRoleRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      11,
      3,
      param.targetMid
    ],
    [
      8,
      4,
      LiveTalkRole(param.targetRole)
    ]
  ];
}
export function InviteToListenRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      11,
      3,
      param.targetMid
    ]
  ];
}
export function InviteToLiveTalkRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      15,
      3,
      [
        11,
        param.invitees
      ]
    ]
  ];
}
export function InviteToSpeakRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      11,
      3,
      param.targetMid
    ]
  ];
}
export function BooleanState(param) {
  return typeof param === "string" ? LINETypes.enums.BooleanState[param] : param;
}
export function JoinLiveTalkRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      2,
      3,
      param.wantToSpeak
    ],
    [
      8,
      4,
      BooleanState(param.claimAdult)
    ]
  ];
}
export function LiveTalkParticipant(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.mid
    ]
  ];
}
export function AllNonMemberLiveTalkParticipants(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LiveTalkKickOutTarget(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      LiveTalkParticipant(param.liveTalkParticipant)
    ],
    [
      12,
      2,
      AllNonMemberLiveTalkParticipants(param.allNonMemberLiveTalkParticipants)
    ]
  ];
}
export function KickOutLiveTalkParticipantsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      12,
      3,
      LiveTalkKickOutTarget(param.target)
    ]
  ];
}
export function RejectSpeakersRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      14,
      3,
      [
        11,
        param.targetMids
      ]
    ]
  ];
}
export function RejectToSpeakRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      11,
      3,
      param.inviteRequestId
    ]
  ];
}
export function RemoveLiveTalkSubscriptionRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ]
  ];
}
export function LiveTalkReportType(param) {
  return typeof param === "string" ? LINETypes.enums.LiveTalkReportType[param] : param;
}
export function ReportLiveTalkRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      8,
      3,
      LiveTalkReportType(param.reportType)
    ]
  ];
}
export function ReportLiveTalkSpeakerRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      11,
      3,
      param.speakerMemberMid
    ],
    [
      8,
      4,
      LiveTalkReportType(param.reportType)
    ]
  ];
}
export function RequestToListenRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ]
  ];
}
export function RequestToSpeakRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ]
  ];
}
export function LiveTalkAttribute(param) {
  return typeof param === "string" ? LINETypes.enums.LiveTalkAttribute[param] : param;
}
export function LiveTalk(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.sessionId
    ],
    [
      11,
      3,
      param.title
    ],
    [
      8,
      4,
      LiveTalkType(param.type)
    ],
    [
      8,
      5,
      LiveTalkSpeakerSetting(param.speakerSetting)
    ],
    [
      2,
      6,
      param.allowRequestToSpeak
    ],
    [
      11,
      7,
      param.hostMemberMid
    ],
    [
      11,
      8,
      param.announcement
    ],
    [
      8,
      9,
      param.participantCount
    ],
    [
      10,
      10,
      param.revision
    ],
    [
      10,
      11,
      param.startedAt
    ]
  ];
}
export function UpdateLiveTalkAttrsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      1,
      [
        8,
        param.updatedAttrs && param.updatedAttrs.map((e)=>LiveTalkAttribute(e))
      ]
    ],
    [
      12,
      2,
      LiveTalk(param.liveTalk)
    ]
  ];
}
export function Pb1_D4(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_D4[param] : param;
}
export function Pb1_EnumC13222w4(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_EnumC13222w4[param] : param;
}
export function Pb1_EnumC13237x5(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_EnumC13237x5[param] : param;
}
export function AcquireOACallRouteRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.searchId
    ],
    [
      13,
      2,
      [
        11,
        11,
        param.fromEnvInfo
      ]
    ],
    [
      11,
      3,
      param.otp
    ]
  ];
}
export function PaidCallType(param) {
  return typeof param === "string" ? LINETypes.enums.PaidCallType[param] : param;
}
export function og_EnumC32661b(param) {
  return typeof param === "string" ? LINETypes.enums.og_EnumC32661b[param] : param;
}
export function ActivateSubscriptionRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.uniqueKey
    ],
    [
      8,
      2,
      og_EnumC32661b(param.activeStatus)
    ]
  ];
}
export function AdTypeOptOutClickEventRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.moduleAdId
    ],
    [
      11,
      2,
      param.targetId
    ]
  ];
}
export function AddMetaInvalid(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.hint
    ]
  ];
}
export function AddMetaByPhone(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.phone
    ]
  ];
}
export function AddMetaBySearchId(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.searchId
    ]
  ];
}
export function AddMetaByUserTicket(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.ticket
    ]
  ];
}
export function AddMetaGroupMemberList(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ]
  ];
}
export function LN0_P(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_L(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_G(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_C11282h(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_C11300q(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_C11307u(param) {
  return typeof param === "undefined" ? [] : [];
}
export function AddMetaShareContact(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.messageId
    ],
    [
      11,
      2,
      param.chatMid
    ],
    [
      11,
      3,
      param.senderMid
    ]
  ];
}
export function AddMetaStrangerMessage(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.messageId
    ],
    [
      11,
      2,
      param.chatMid
    ]
  ];
}
export function AddMetaStrangerCall(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.messageId
    ]
  ];
}
export function AddMetaMentionInChat(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ],
    [
      11,
      2,
      param.messageId
    ]
  ];
}
export function LN0_O(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_Q(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_C11313x(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_A(param) {
  return typeof param === "undefined" ? [] : [];
}
export function AddMetaGroupVideoCall(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ]
  ];
}
export function LN0_r(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_C11315y(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_C11316z(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_B(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_C11280g(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_T(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_C11276e(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_S(param) {
  return typeof param === "undefined" ? [] : [];
}
export function AddMetaProfileUndefined(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.hint
    ]
  ];
}
export function LN0_F(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_C11294n(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_C11290l(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_C11309v(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_C11292m(param) {
  return typeof param === "undefined" ? [] : [];
}
export function AddMetaChatNote(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ]
  ];
}
export function AddMetaChatNoteMenu(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ]
  ];
}
export function LN0_U(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_E(param) {
  return typeof param === "undefined" ? [] : [];
}
export function AddMetaSearchIdInUnifiedSearch(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.searchId
    ]
  ];
}
export function LN0_D(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_C11278f(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_H(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LN0_C11274d(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      AddMetaInvalid(param.invalid)
    ],
    [
      12,
      2,
      AddMetaByPhone(param.byPhone)
    ],
    [
      12,
      3,
      AddMetaBySearchId(param.bySearchId)
    ],
    [
      12,
      4,
      AddMetaByUserTicket(param.byUserTicket)
    ],
    [
      12,
      5,
      AddMetaGroupMemberList(param.groupMemberList)
    ],
    [
      12,
      6,
      LN0_P(param.timelineCPF)
    ],
    [
      12,
      7,
      LN0_L(param.smartChannelCPF)
    ],
    [
      12,
      8,
      LN0_G(param.openchatCPF)
    ],
    [
      12,
      9,
      LN0_C11282h(param.beaconBanner)
    ],
    [
      12,
      10,
      LN0_C11300q(param.friendRecommendation)
    ],
    [
      12,
      11,
      LN0_C11307u(param.homeRecommendation)
    ],
    [
      12,
      12,
      AddMetaShareContact(param.shareContact)
    ],
    [
      12,
      13,
      AddMetaStrangerMessage(param.strangerMessage)
    ],
    [
      12,
      14,
      AddMetaStrangerCall(param.strangerCall)
    ],
    [
      12,
      15,
      AddMetaMentionInChat(param.mentionInChat)
    ],
    [
      12,
      16,
      LN0_O(param.timeline)
    ],
    [
      12,
      17,
      LN0_Q(param.unifiedSearch)
    ],
    [
      12,
      18,
      LN0_C11313x(param.lineLab)
    ],
    [
      12,
      19,
      LN0_A(param.lineToCall)
    ],
    [
      12,
      20,
      AddMetaGroupVideoCall(param.groupVideo)
    ],
    [
      12,
      21,
      LN0_r(param.friendRequest)
    ],
    [
      12,
      22,
      LN0_C11315y(param.liveViewer)
    ],
    [
      12,
      23,
      LN0_C11316z(param.lineThings)
    ],
    [
      12,
      24,
      LN0_B(param.mediaCapture)
    ],
    [
      12,
      25,
      LN0_C11280g(param.avatarOASetting)
    ],
    [
      12,
      26,
      LN0_T(param.urlScheme)
    ],
    [
      12,
      27,
      LN0_C11276e(param.addressBook)
    ],
    [
      12,
      28,
      LN0_S(param.unifiedSearchOATab)
    ],
    [
      12,
      29,
      AddMetaProfileUndefined(param.profileUndefined)
    ],
    [
      12,
      30,
      LN0_F(param.DEPRECATED_oaChatHeader)
    ],
    [
      12,
      31,
      LN0_C11294n(param.chatMenu)
    ],
    [
      12,
      32,
      LN0_C11290l(param.chatHeader)
    ],
    [
      12,
      33,
      LN0_C11309v(param.homeTabCPF)
    ],
    [
      12,
      34,
      LN0_C11292m(param.chatList)
    ],
    [
      12,
      35,
      AddMetaChatNote(param.chatNote)
    ],
    [
      12,
      36,
      AddMetaChatNoteMenu(param.chatNoteMenu)
    ],
    [
      12,
      37,
      LN0_U(param.walletTabCPF)
    ],
    [
      12,
      38,
      LN0_E(param.oaCall)
    ],
    [
      12,
      39,
      AddMetaSearchIdInUnifiedSearch(param.searchIdInUnifiedSearch)
    ],
    [
      12,
      40,
      LN0_D(param.newsDigestADCPF)
    ],
    [
      12,
      41,
      LN0_C11278f(param.albumCPF)
    ],
    [
      12,
      42,
      LN0_H(param.premiumAgreement)
    ]
  ];
}
export function AddFriendTracking(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.reference
    ],
    [
      12,
      2,
      LN0_C11274d(param.trackingMeta)
    ]
  ];
}
export function AddFriendByMidRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.userMid
    ],
    [
      12,
      3,
      AddFriendTracking(param.tracking)
    ]
  ];
}
export function Ob1_O0(param) {
  return typeof param === "string" ? LINETypes.enums.Ob1_O0[param] : param;
}
export function AddItemToCollectionRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.collectionId
    ],
    [
      8,
      2,
      Ob1_O0(param.productType)
    ],
    [
      11,
      3,
      param.productId
    ],
    [
      11,
      4,
      param.itemId
    ]
  ];
}
export function NZ0_C12155c(param) {
  return typeof param === "undefined" ? [] : [];
}
export function AddProductToSubscriptionSlotRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Ob1_O0(param.productType)
    ],
    [
      11,
      2,
      param.productId
    ],
    [
      11,
      3,
      param.oldProductId
    ]
  ];
}
export function AddThemeToSubscriptionSlotRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.productId
    ],
    [
      11,
      2,
      param.currentlyAppliedProductId
    ]
  ];
}
export function Pb1_A4(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.mid
    ],
    [
      11,
      2,
      param.eMid
    ]
  ];
}
export function AddToFollowBlacklistRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Pb1_A4(param.followMid)
    ]
  ];
}
export function TermsAgreement(param) {
  return typeof param === "undefined" ? [] : [];
}
export function AgreeToTermsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      TermsAgreement(param.termsAgreement)
    ]
  ];
}
export function ApproveSquareMembersRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ],
    [
      15,
      3,
      [
        11,
        param.requestedMemberMids
      ]
    ]
  ];
}
export function CheckJoinCodeRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ],
    [
      11,
      3,
      param.joinCode
    ]
  ];
}
export function TextMessageAnnouncementContents(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.messageId
    ],
    [
      11,
      2,
      param.text
    ],
    [
      11,
      3,
      param.senderSquareMemberMid
    ],
    [
      10,
      4,
      param.createdAt
    ]
  ];
}
export function SquareChatAnnouncementContents(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      TextMessageAnnouncementContents(param.textMessageAnnouncementContents)
    ]
  ];
}
export function SquareChatAnnouncement(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      1,
      param.announcementSeq
    ],
    [
      8,
      2,
      param.type
    ],
    [
      12,
      3,
      SquareChatAnnouncementContents(param.contents)
    ],
    [
      10,
      4,
      param.createdAt
    ],
    [
      11,
      5,
      param.creator
    ]
  ];
}
export function CreateSquareChatAnnouncementRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.squareChatMid
    ],
    [
      12,
      3,
      SquareChatAnnouncement(param.squareChatAnnouncement)
    ]
  ];
}
export function SquareChatType(param) {
  return typeof param === "string" ? LINETypes.enums.SquareChatType[param] : param;
}
export function SquareChatState(param) {
  return typeof param === "string" ? LINETypes.enums.SquareChatState[param] : param;
}
export function MessageVisibility(param) {
  return typeof param === "undefined" ? [] : [
    [
      2,
      1,
      param.showJoinMessage
    ],
    [
      2,
      2,
      param.showLeaveMessage
    ],
    [
      2,
      3,
      param.showKickoutMessage
    ]
  ];
}
export function SquareChat(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.squareMid
    ],
    [
      8,
      3,
      SquareChatType(param.type)
    ],
    [
      11,
      4,
      param.name
    ],
    [
      11,
      5,
      param.chatImageObsHash
    ],
    [
      10,
      6,
      param.squareChatRevision
    ],
    [
      8,
      7,
      param.maxMemberCount
    ],
    [
      8,
      8,
      SquareChatState(param.state)
    ],
    [
      11,
      9,
      param.invitationUrl
    ],
    [
      12,
      10,
      MessageVisibility(param.messageVisibility)
    ],
    [
      8,
      11,
      BooleanState(param.ableToSearchMessage)
    ]
  ];
}
export function CreateSquareChatRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      12,
      2,
      SquareChat(param.squareChat)
    ],
    [
      15,
      3,
      [
        11,
        param.squareMemberMids
      ]
    ]
  ];
}
export function SquareType(param) {
  return typeof param === "string" ? LINETypes.enums.SquareType[param] : param;
}
export function SquareState(param) {
  return typeof param === "string" ? LINETypes.enums.SquareState[param] : param;
}
export function SquareEmblem(param) {
  return typeof param === "string" ? LINETypes.enums.SquareEmblem[param] : param;
}
export function SquareJoinMethodType(param) {
  return typeof param === "string" ? LINETypes.enums.SquareJoinMethodType[param] : param;
}
export function ApprovalValue(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.message
    ]
  ];
}
export function CodeValue(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.code
    ]
  ];
}
export function SquareJoinMethodValue(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ApprovalValue(param.approvalValue)
    ],
    [
      12,
      2,
      CodeValue(param.codeValue)
    ]
  ];
}
export function SquareJoinMethod(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      SquareJoinMethodType(param.type)
    ],
    [
      12,
      2,
      SquareJoinMethodValue(param.value)
    ]
  ];
}
export function Square(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.mid
    ],
    [
      11,
      2,
      param.name
    ],
    [
      11,
      3,
      param.welcomeMessage
    ],
    [
      11,
      4,
      param.profileImageObsHash
    ],
    [
      11,
      5,
      param.desc
    ],
    [
      2,
      6,
      param.searchable
    ],
    [
      8,
      7,
      SquareType(param.type)
    ],
    [
      8,
      8,
      param.categoryId
    ],
    [
      11,
      9,
      param.invitationURL
    ],
    [
      10,
      10,
      param.revision
    ],
    [
      2,
      11,
      param.ableToUseInvitationTicket
    ],
    [
      8,
      12,
      SquareState(param.state)
    ],
    [
      15,
      13,
      [
        8,
        param.emblems && param.emblems.map((e)=>SquareEmblem(e))
      ]
    ],
    [
      12,
      14,
      SquareJoinMethod(param.joinMethod)
    ],
    [
      8,
      15,
      BooleanState(param.adultOnly)
    ],
    [
      15,
      16,
      [
        11,
        param.svcTags
      ]
    ],
    [
      10,
      17,
      param.createdAt
    ]
  ];
}
export function SquareMembershipState(param) {
  return typeof param === "string" ? LINETypes.enums.SquareMembershipState[param] : param;
}
export function SquareMemberRole(param) {
  return typeof param === "string" ? LINETypes.enums.SquareMemberRole[param] : param;
}
export function SquarePreference(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      1,
      param.favoriteTimestamp
    ],
    [
      2,
      2,
      param.notiForNewJoinRequest
    ]
  ];
}
export function SquareMember(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareMemberMid
    ],
    [
      11,
      2,
      param.squareMid
    ],
    [
      11,
      3,
      param.displayName
    ],
    [
      11,
      4,
      param.profileImageObsHash
    ],
    [
      2,
      5,
      param.ableToReceiveMessage
    ],
    [
      8,
      7,
      SquareMembershipState(param.membershipState)
    ],
    [
      8,
      8,
      SquareMemberRole(param.role)
    ],
    [
      10,
      9,
      param.revision
    ],
    [
      12,
      10,
      SquarePreference(param.preference)
    ],
    [
      11,
      11,
      param.joinMessage
    ],
    [
      10,
      12,
      param.createdAt
    ]
  ];
}
export function CreateSquareRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      12,
      2,
      Square(param.square)
    ],
    [
      12,
      3,
      SquareMember(param.creator)
    ]
  ];
}
export function DeleteSquareChatAnnouncementRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareChatMid
    ],
    [
      10,
      3,
      param.announcementSeq
    ]
  ];
}
export function DeleteSquareChatRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareChatMid
    ],
    [
      10,
      3,
      param.revision
    ]
  ];
}
export function DeleteSquareRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.mid
    ],
    [
      10,
      3,
      param.revision
    ]
  ];
}
export function DestroyMessageRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareChatMid
    ],
    [
      11,
      4,
      param.messageId
    ],
    [
      11,
      5,
      param.threadMid
    ]
  ];
}
export function DestroyMessagesRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareChatMid
    ],
    [
      14,
      4,
      [
        11,
        param.messageIds
      ]
    ],
    [
      11,
      5,
      param.threadMid
    ]
  ];
}
export function FetchMyEventsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      1,
      param.subscriptionId
    ],
    [
      11,
      2,
      param.syncToken
    ],
    [
      8,
      3,
      param.limit
    ],
    [
      11,
      4,
      param.continuationToken
    ]
  ];
}
export function FetchDirection(param) {
  return typeof param === "string" ? LINETypes.enums.FetchDirection[param] : param;
}
export function FetchType(param) {
  return typeof param === "string" ? LINETypes.enums.FetchType[param] : param;
}
export function FetchSquareChatEventsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      1,
      param.subscriptionId
    ],
    [
      11,
      2,
      param.squareChatMid
    ],
    [
      11,
      3,
      param.syncToken
    ],
    [
      8,
      4,
      param.limit
    ],
    [
      8,
      5,
      FetchDirection(param.direction)
    ],
    [
      8,
      6,
      BooleanState(param.inclusive)
    ],
    [
      11,
      7,
      param.continuationToken
    ],
    [
      8,
      8,
      FetchType(param.fetchType)
    ],
    [
      11,
      9,
      param.threadMid
    ]
  ];
}
export function FindSquareByEmidRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.emid
    ]
  ];
}
export function FindSquareByInvitationTicketRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.invitationTicket
    ]
  ];
}
export function FindSquareByInvitationTicketV2Request(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.invitationTicket
    ]
  ];
}
export function AdScreen(param) {
  return typeof param === "string" ? LINETypes.enums.AdScreen[param] : param;
}
export function GetGoogleAdOptionsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareMid
    ],
    [
      11,
      2,
      param.chatMid
    ],
    [
      8,
      3,
      AdScreen(param.adScreen)
    ]
  ];
}
export function GetInvitationTicketUrlRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.mid
    ]
  ];
}
export function GetJoinableSquareChatsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareMid
    ],
    [
      11,
      10,
      param.continuationToken
    ],
    [
      8,
      11,
      param.limit
    ]
  ];
}
export function GetJoinedSquareChatsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.continuationToken
    ],
    [
      8,
      3,
      param.limit
    ]
  ];
}
export function GetJoinedSquaresRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.continuationToken
    ],
    [
      8,
      3,
      param.limit
    ]
  ];
}
export function MessageReactionType(param) {
  return typeof param === "string" ? LINETypes.enums.MessageReactionType[param] : param;
}
export function GetMessageReactionsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.messageId
    ],
    [
      8,
      3,
      MessageReactionType(param.type)
    ],
    [
      11,
      4,
      param.continuationToken
    ],
    [
      8,
      5,
      param.limit
    ],
    [
      11,
      6,
      param.threadMid
    ]
  ];
}
export function GetNoteStatusRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ]
  ];
}
export function GetPopularKeywordsRequest(param) {
  return typeof param === "undefined" ? [] : [];
}
export function GetSquareAuthoritiesRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      2,
      [
        11,
        param.squareMids
      ]
    ]
  ];
}
export function GetSquareAuthorityRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareMid
    ]
  ];
}
export function GetSquareCategoriesRequest(param) {
  return typeof param === "undefined" ? [] : [];
}
export function GetSquareChatAnnouncementsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareChatMid
    ]
  ];
}
export function GetSquareChatEmidRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ]
  ];
}
export function GetSquareChatFeatureSetRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareChatMid
    ]
  ];
}
export function GetSquareChatMemberRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMemberMid
    ],
    [
      11,
      3,
      param.squareChatMid
    ]
  ];
}
export function GetSquareChatMembersRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      11,
      2,
      param.continuationToken
    ],
    [
      8,
      3,
      param.limit
    ]
  ];
}
export function GetSquareChatRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ]
  ];
}
export function GetSquareChatStatusRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareChatMid
    ]
  ];
}
export function GetSquareEmidRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareMid
    ]
  ];
}
export function GetSquareFeatureSetRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ]
  ];
}
export function GetSquareMemberRelationRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ],
    [
      11,
      3,
      param.targetSquareMemberMid
    ]
  ];
}
export function SquareMemberRelationState(param) {
  return typeof param === "string" ? LINETypes.enums.SquareMemberRelationState[param] : param;
}
export function GetSquareMemberRelationsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      2,
      SquareMemberRelationState(param.state)
    ],
    [
      11,
      3,
      param.continuationToken
    ],
    [
      8,
      4,
      param.limit
    ]
  ];
}
export function GetSquareMemberRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMemberMid
    ]
  ];
}
export function GetSquareMembersBySquareRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ],
    [
      14,
      3,
      [
        11,
        param.squareMemberMids
      ]
    ]
  ];
}
export function GetSquareMembersRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      2,
      [
        11,
        param.mids
      ]
    ]
  ];
}
export function GetSquareRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.mid
    ]
  ];
}
export function GetSquareStatusRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ]
  ];
}
export function GetSquareThreadMidRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ],
    [
      11,
      2,
      param.messageId
    ]
  ];
}
export function GetSquareThreadRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.threadMid
    ],
    [
      2,
      2,
      param.includeRootMessage
    ]
  ];
}
export function GetUserSettingsRequest(param) {
  return typeof param === "undefined" ? [] : [];
}
export function HideSquareMemberContentsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareMemberMid
    ]
  ];
}
export function InviteIntoSquareChatRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        11,
        param.inviteeMids
      ]
    ],
    [
      11,
      2,
      param.squareChatMid
    ]
  ];
}
export function InviteToSquareRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ],
    [
      15,
      3,
      [
        11,
        param.invitees
      ]
    ],
    [
      11,
      4,
      param.squareChatMid
    ]
  ];
}
export function JoinSquareChatRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ]
  ];
}
export function JoinSquareRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ],
    [
      12,
      3,
      SquareMember(param.member)
    ],
    [
      11,
      4,
      param.squareChatMid
    ],
    [
      12,
      5,
      SquareJoinMethodValue(param.joinValue)
    ],
    [
      8,
      6,
      BooleanState(param.claimAdult)
    ]
  ];
}
export function JoinSquareThreadRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ],
    [
      11,
      2,
      param.threadMid
    ]
  ];
}
export function LeaveSquareChatRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareChatMid
    ],
    [
      2,
      3,
      param.sayGoodbye
    ],
    [
      10,
      4,
      param.squareChatMemberRevision
    ]
  ];
}
export function LeaveSquareRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ]
  ];
}
export function LeaveSquareThreadRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ],
    [
      11,
      2,
      param.threadMid
    ]
  ];
}
export function ManualRepairRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.syncToken
    ],
    [
      8,
      2,
      param.limit
    ],
    [
      11,
      3,
      param.continuationToken
    ]
  ];
}
export function MarkAsReadRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareChatMid
    ],
    [
      11,
      4,
      param.messageId
    ],
    [
      11,
      5,
      param.threadMid
    ]
  ];
}
export function MarkChatsAsReadRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      2,
      [
        11,
        param.chatMids
      ]
    ]
  ];
}
export function MarkThreadsAsReadRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ]
  ];
}
export function ReactToMessageRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.squareChatMid
    ],
    [
      11,
      3,
      param.messageId
    ],
    [
      8,
      4,
      MessageReactionType(param.reactionType)
    ],
    [
      11,
      5,
      param.threadMid
    ]
  ];
}
export function RefreshSubscriptionsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      2,
      [
        10,
        param.subscriptions
      ]
    ]
  ];
}
export function RejectSquareMembersRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ],
    [
      15,
      3,
      [
        11,
        param.requestedMemberMids
      ]
    ]
  ];
}
export function RemoveSubscriptionsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      2,
      [
        10,
        param.unsubscriptions
      ]
    ]
  ];
}
export function MessageSummaryReportType(param) {
  return typeof param === "string" ? LINETypes.enums.MessageSummaryReportType[param] : param;
}
export function ReportMessageSummaryRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatEmid
    ],
    [
      10,
      2,
      param.messageSummaryRangeTo
    ],
    [
      8,
      3,
      MessageSummaryReportType(param.reportType)
    ]
  ];
}
export function ReportType(param) {
  return typeof param === "string" ? LINETypes.enums.ReportType[param] : param;
}
export function ReportSquareChatRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ],
    [
      11,
      3,
      param.squareChatMid
    ],
    [
      8,
      5,
      ReportType(param.reportType)
    ],
    [
      11,
      6,
      param.otherReason
    ]
  ];
}
export function ReportSquareMemberRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMemberMid
    ],
    [
      8,
      3,
      ReportType(param.reportType)
    ],
    [
      11,
      4,
      param.otherReason
    ],
    [
      11,
      5,
      param.squareChatMid
    ],
    [
      11,
      6,
      param.threadMid
    ]
  ];
}
export function ReportSquareMessageRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ],
    [
      11,
      3,
      param.squareChatMid
    ],
    [
      11,
      4,
      param.squareMessageId
    ],
    [
      8,
      5,
      ReportType(param.reportType)
    ],
    [
      11,
      6,
      param.otherReason
    ],
    [
      11,
      7,
      param.threadMid
    ]
  ];
}
export function ReportSquareRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ],
    [
      8,
      3,
      ReportType(param.reportType)
    ],
    [
      11,
      4,
      param.otherReason
    ]
  ];
}
export function SquareChatMemberSearchOption(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.displayName
    ],
    [
      2,
      2,
      param.includingMe
    ]
  ];
}
export function SearchSquareChatMembersRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      12,
      2,
      SquareChatMemberSearchOption(param.searchOption)
    ],
    [
      11,
      3,
      param.continuationToken
    ],
    [
      8,
      4,
      param.limit
    ]
  ];
}
export function SquareChatMentionableSearchOption(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.displayName
    ]
  ];
}
export function SearchSquareChatMentionablesRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ],
    [
      12,
      2,
      SquareChatMentionableSearchOption(param.searchOption)
    ],
    [
      11,
      3,
      param.continuationToken
    ],
    [
      8,
      4,
      param.limit
    ]
  ];
}
export function SquareMemberSearchOption(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      SquareMembershipState(param.membershipState)
    ],
    [
      14,
      2,
      [
        8,
        param.memberRoles && param.memberRoles.map((e)=>SquareMemberRole(e))
      ]
    ],
    [
      11,
      3,
      param.displayName
    ],
    [
      8,
      4,
      BooleanState(param.ableToReceiveMessage)
    ],
    [
      8,
      5,
      BooleanState(param.ableToReceiveFriendRequest)
    ],
    [
      11,
      6,
      param.chatMidToExcludeMembers
    ],
    [
      2,
      7,
      param.includingMe
    ],
    [
      2,
      8,
      param.excludeBlockedMembers
    ],
    [
      2,
      9,
      param.includingMeOnlyMatch
    ]
  ];
}
export function SearchSquareMembersRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ],
    [
      12,
      3,
      SquareMemberSearchOption(param.searchOption)
    ],
    [
      11,
      4,
      param.continuationToken
    ],
    [
      8,
      5,
      param.limit
    ]
  ];
}
export function SearchSquaresRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.query
    ],
    [
      11,
      3,
      param.continuationToken
    ],
    [
      8,
      4,
      param.limit
    ]
  ];
}
export function MIDType(param) {
  return typeof param === "string" ? LINETypes.enums.MIDType[param] : param;
}
export function Pb1_D6(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_D6[param] : param;
}
export function Pb1_EnumC13050k(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_EnumC13050k[param] : param;
}
export function GeolocationAccuracy(param) {
  return typeof param === "undefined" ? [] : [
    [
      4,
      1,
      param.radiusMeters
    ],
    [
      4,
      2,
      param.radiusConfidence
    ],
    [
      4,
      3,
      param.altitudeAccuracy
    ],
    [
      4,
      4,
      param.velocityAccuracy
    ],
    [
      4,
      5,
      param.bearingAccuracy
    ],
    [
      8,
      6,
      Pb1_EnumC13050k(param.accuracyMode)
    ]
  ];
}
export function Location(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.title
    ],
    [
      11,
      2,
      param.address
    ],
    [
      4,
      3,
      param.latitude
    ],
    [
      4,
      4,
      param.longitude
    ],
    [
      11,
      5,
      param.phone
    ],
    [
      11,
      6,
      param.categoryId
    ],
    [
      8,
      7,
      Pb1_D6(param.provider)
    ],
    [
      12,
      8,
      GeolocationAccuracy(param.accuracy)
    ],
    [
      4,
      9,
      param.altitudeMeters
    ]
  ];
}
export function ContentType(param) {
  return typeof param === "string" ? LINETypes.enums.ContentType[param] : param;
}
export function Pb1_EnumC13015h6(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_EnumC13015h6[param] : param;
}
export function Pb1_E7(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_E7[param] : param;
}
export function Pb1_B(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_B[param] : param;
}
export function ReactionType(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      MessageReactionType(param.predefinedReactionType)
    ]
  ];
}
export function Reaction(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.fromUserMid
    ],
    [
      10,
      2,
      param.atMillis
    ],
    [
      12,
      3,
      ReactionType(param.reactionType)
    ]
  ];
}
export function Message(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.from
    ],
    [
      11,
      2,
      param.to
    ],
    [
      8,
      3,
      MIDType(param.toType)
    ],
    [
      11,
      4,
      param.id
    ],
    [
      10,
      5,
      param.createdTime
    ],
    [
      10,
      6,
      param.deliveredTime
    ],
    [
      11,
      10,
      param.text
    ],
    [
      12,
      11,
      Location(param.location)
    ],
    [
      2,
      14,
      param.hasContent
    ],
    [
      8,
      15,
      ContentType(param.contentType)
    ],
    [
      11,
      17,
      param.contentPreview
    ],
    [
      13,
      18,
      [
        11,
        11,
        param.contentMetadata
      ]
    ],
    [
      3,
      19,
      param.sessionId
    ],
    [
      15,
      20,
      [
        11,
        param.chunks
      ]
    ],
    [
      11,
      21,
      param.relatedMessageId
    ],
    [
      8,
      22,
      Pb1_EnumC13015h6(param.messageRelationType)
    ],
    [
      8,
      23,
      param.readCount
    ],
    [
      8,
      24,
      Pb1_E7(param.relatedMessageServiceCode)
    ],
    [
      8,
      25,
      Pb1_B(param.appExtensionType)
    ],
    [
      15,
      27,
      [
        12,
        param.reactions && param.reactions.map((e)=>Reaction(e))
      ]
    ]
  ];
}
export function SquareMessageState(param) {
  return typeof param === "string" ? LINETypes.enums.SquareMessageState[param] : param;
}
export function SquareMessageThreadInfo(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatThreadMid
    ],
    [
      2,
      2,
      param.threadRoot
    ]
  ];
}
export function SquareMessage(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Message(param.message)
    ],
    [
      8,
      3,
      MIDType(param.fromType)
    ],
    [
      10,
      4,
      param.squareMessageRevision
    ],
    [
      8,
      5,
      SquareMessageState(param.state)
    ],
    [
      12,
      6,
      SquareMessageThreadInfo(param.threadInfo)
    ]
  ];
}
export function SendMessageRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.squareChatMid
    ],
    [
      12,
      3,
      SquareMessage(param.squareMessage)
    ]
  ];
}
export function SendSquareThreadMessageRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.chatMid
    ],
    [
      11,
      3,
      param.threadMid
    ],
    [
      12,
      4,
      SquareMessage(param.threadMessage)
    ]
  ];
}
export function SyncSquareMembersRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareMid
    ],
    [
      13,
      2,
      [
        11,
        10,
        param.squareMembers
      ]
    ]
  ];
}
export function UnhideSquareMemberContentsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareMemberMid
    ]
  ];
}
export function UnsendMessageRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareChatMid
    ],
    [
      11,
      3,
      param.messageId
    ],
    [
      11,
      4,
      param.threadMid
    ]
  ];
}
export function SquareAuthorityAttribute(param) {
  return typeof param === "string" ? LINETypes.enums.SquareAuthorityAttribute[param] : param;
}
export function SquareAuthority(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareMid
    ],
    [
      8,
      2,
      SquareMemberRole(param.updateSquareProfile)
    ],
    [
      8,
      3,
      SquareMemberRole(param.inviteNewMember)
    ],
    [
      8,
      4,
      SquareMemberRole(param.approveJoinRequest)
    ],
    [
      8,
      5,
      SquareMemberRole(param.createPost)
    ],
    [
      8,
      6,
      SquareMemberRole(param.createOpenSquareChat)
    ],
    [
      8,
      7,
      SquareMemberRole(param.deleteSquareChatOrPost)
    ],
    [
      8,
      8,
      SquareMemberRole(param.removeSquareMember)
    ],
    [
      8,
      9,
      SquareMemberRole(param.grantRole)
    ],
    [
      8,
      10,
      SquareMemberRole(param.enableInvitationTicket)
    ],
    [
      10,
      11,
      param.revision
    ],
    [
      8,
      12,
      SquareMemberRole(param.createSquareChatAnnouncement)
    ],
    [
      8,
      13,
      SquareMemberRole(param.updateMaxChatMemberCount)
    ],
    [
      8,
      14,
      SquareMemberRole(param.useReadonlyDefaultChat)
    ],
    [
      8,
      15,
      SquareMemberRole(param.sendAllMention)
    ]
  ];
}
export function UpdateSquareAuthorityRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      2,
      [
        8,
        param.updateAttributes && param.updateAttributes.map((e)=>SquareAuthorityAttribute(e))
      ]
    ],
    [
      12,
      3,
      SquareAuthority(param.authority)
    ]
  ];
}
export function SquareChatMemberAttribute(param) {
  return typeof param === "string" ? LINETypes.enums.SquareChatMemberAttribute[param] : param;
}
export function SquareChatMembershipState(param) {
  return typeof param === "string" ? LINETypes.enums.SquareChatMembershipState[param] : param;
}
export function SquareChatMember(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareMemberMid
    ],
    [
      11,
      2,
      param.squareChatMid
    ],
    [
      10,
      3,
      param.revision
    ],
    [
      8,
      4,
      SquareChatMembershipState(param.membershipState)
    ],
    [
      2,
      5,
      param.notificationForMessage
    ],
    [
      2,
      6,
      param.notificationForNewMember
    ]
  ];
}
export function UpdateSquareChatMemberRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      2,
      [
        8,
        param.updatedAttrs && param.updatedAttrs.map((e)=>SquareChatMemberAttribute(e))
      ]
    ],
    [
      12,
      3,
      SquareChatMember(param.chatMember)
    ]
  ];
}
export function SquareChatAttribute(param) {
  return typeof param === "string" ? LINETypes.enums.SquareChatAttribute[param] : param;
}
export function UpdateSquareChatRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      2,
      [
        8,
        param.updatedAttrs && param.updatedAttrs.map((e)=>SquareChatAttribute(e))
      ]
    ],
    [
      12,
      3,
      SquareChat(param.squareChat)
    ]
  ];
}
export function SquareFeatureSetAttribute(param) {
  return typeof param === "string" ? LINETypes.enums.SquareFeatureSetAttribute[param] : param;
}
export function SquareFeatureControlState(param) {
  return typeof param === "string" ? LINETypes.enums.SquareFeatureControlState[param] : param;
}
export function SquareFeature(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      SquareFeatureControlState(param.controlState)
    ],
    [
      8,
      2,
      BooleanState(param.booleanValue)
    ]
  ];
}
export function SquareFeatureSet(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareMid
    ],
    [
      10,
      2,
      param.revision
    ],
    [
      12,
      11,
      SquareFeature(param.creatingSecretSquareChat)
    ],
    [
      12,
      12,
      SquareFeature(param.invitingIntoOpenSquareChat)
    ],
    [
      12,
      13,
      SquareFeature(param.creatingSquareChat)
    ],
    [
      12,
      14,
      SquareFeature(param.readonlyDefaultChat)
    ],
    [
      12,
      15,
      SquareFeature(param.showingAdvertisement)
    ],
    [
      12,
      16,
      SquareFeature(param.delegateJoinToPlug)
    ],
    [
      12,
      17,
      SquareFeature(param.delegateKickOutToPlug)
    ],
    [
      12,
      18,
      SquareFeature(param.disableUpdateJoinMethod)
    ],
    [
      12,
      19,
      SquareFeature(param.disableTransferAdmin)
    ],
    [
      12,
      20,
      SquareFeature(param.creatingLiveTalk)
    ],
    [
      12,
      21,
      SquareFeature(param.disableUpdateSearchable)
    ],
    [
      12,
      22,
      SquareFeature(param.summarizingMessages)
    ],
    [
      12,
      23,
      SquareFeature(param.creatingSquareThread)
    ],
    [
      12,
      24,
      SquareFeature(param.enableSquareThread)
    ],
    [
      12,
      25,
      SquareFeature(param.disableChangeRoleCoAdmin)
    ]
  ];
}
export function UpdateSquareFeatureSetRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      2,
      [
        8,
        param.updateAttributes && param.updateAttributes.map((e)=>SquareFeatureSetAttribute(e))
      ]
    ],
    [
      12,
      3,
      SquareFeatureSet(param.squareFeatureSet)
    ]
  ];
}
export function SquareMemberRelation(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      SquareMemberRelationState(param.state)
    ],
    [
      10,
      2,
      param.revision
    ]
  ];
}
export function UpdateSquareMemberRelationRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.squareMid
    ],
    [
      11,
      3,
      param.targetSquareMemberMid
    ],
    [
      14,
      4,
      [
        8,
        param.updatedAttrs
      ]
    ],
    [
      12,
      5,
      SquareMemberRelation(param.relation)
    ]
  ];
}
export function SquareMemberAttribute(param) {
  return typeof param === "string" ? LINETypes.enums.SquareMemberAttribute[param] : param;
}
export function SquarePreferenceAttribute(param) {
  return typeof param === "string" ? LINETypes.enums.SquarePreferenceAttribute[param] : param;
}
export function UpdateSquareMemberRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      2,
      [
        8,
        param.updatedAttrs && param.updatedAttrs.map((e)=>SquareMemberAttribute(e))
      ]
    ],
    [
      14,
      3,
      [
        8,
        param.updatedPreferenceAttrs && param.updatedPreferenceAttrs.map((e)=>SquarePreferenceAttribute(e))
      ]
    ],
    [
      12,
      4,
      SquareMember(param.squareMember)
    ]
  ];
}
export function UpdateSquareMembersRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      2,
      [
        8,
        param.updatedAttrs && param.updatedAttrs.map((e)=>SquareMemberAttribute(e))
      ]
    ],
    [
      15,
      3,
      [
        12,
        param.members && param.members.map((e)=>SquareMember(e))
      ]
    ]
  ];
}
export function SquareAttribute(param) {
  return typeof param === "string" ? LINETypes.enums.SquareAttribute[param] : param;
}
export function UpdateSquareRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      2,
      [
        8,
        param.updatedAttrs && param.updatedAttrs.map((e)=>SquareAttribute(e))
      ]
    ],
    [
      12,
      3,
      Square(param.square)
    ]
  ];
}
export function SquareUserSettings(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      BooleanState(param.liveTalkNotification)
    ]
  ];
}
export function UpdateUserSettingsRequest(param) {
  return typeof param === "undefined" ? [] : [
    ,
    [
      12,
      2,
      SquareUserSettings(param.userSettings)
    ]
  ];
}
export function r80_EnumC34362b(param) {
  return typeof param === "string" ? LINETypes.enums.r80_EnumC34362b[param] : param;
}
export function r80_EnumC34361a(param) {
  return typeof param === "string" ? LINETypes.enums.r80_EnumC34361a[param] : param;
}
export function AuthenticatorAssertionResponse(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.clientDataJSON
    ],
    [
      11,
      2,
      param.authenticatorData
    ],
    [
      11,
      3,
      param.signature
    ],
    [
      11,
      4,
      param.userHandle
    ]
  ];
}
export function AuthenticationExtensionsClientOutputs(param) {
  return typeof param === "undefined" ? [] : [
    [
      2,
      91,
      param.lineAuthenSel
    ]
  ];
}
export function AuthPublicKeyCredential(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.id
    ],
    [
      11,
      2,
      param.type
    ],
    [
      12,
      3,
      AuthenticatorAssertionResponse(param.response)
    ],
    [
      12,
      4,
      AuthenticationExtensionsClientOutputs(param.extensionResults)
    ]
  ];
}
export function AuthenticateWithPaakRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ],
    [
      12,
      2,
      AuthPublicKeyCredential(param.credential)
    ]
  ];
}
export function BulkFollowRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      1,
      [
        11,
        param.followTargetMids
      ]
    ],
    [
      14,
      2,
      [
        11,
        param.unfollowTargetMids
      ]
    ],
    [
      2,
      3,
      param.hasNext
    ]
  ];
}
export function t80_h(param) {
  return typeof param === "string" ? LINETypes.enums.t80_h[param] : param;
}
export function GetRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.keyName
    ],
    [
      8,
      2,
      t80_h(param.ns)
    ]
  ];
}
export function BulkGetRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      1,
      [
        12,
        param.requests && param.requests.map((e)=>GetRequest(e))
      ]
    ]
  ];
}
export function BuyMustbuyRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Ob1_O0(param.productType)
    ],
    [
      11,
      2,
      param.productId
    ],
    [
      11,
      3,
      param.serialNumber
    ]
  ];
}
export function CanCreateCombinationStickerRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      1,
      [
        11,
        param.packageIds
      ]
    ]
  ];
}
export function Locale(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.language
    ],
    [
      11,
      2,
      param.country
    ]
  ];
}
export function CancelChatInvitationRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.chatMid
    ],
    [
      14,
      3,
      [
        11,
        param.targetUserMids
      ]
    ]
  ];
}
export function CancelPaakAuthRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ]
  ];
}
export function CancelPaakAuthenticationRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ]
  ];
}
export function CancelPinCodeRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ]
  ];
}
export function CancelReactionRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      10,
      2,
      param.messageId
    ]
  ];
}
export function VerificationMethod(param) {
  return typeof param === "string" ? LINETypes.enums.VerificationMethod[param] : param;
}
export function r80_n0(param) {
  return typeof param === "string" ? LINETypes.enums.r80_n0[param] : param;
}
export function T70_EnumC14390b(param) {
  return typeof param === "string" ? LINETypes.enums.T70_EnumC14390b[param] : param;
}
export function AccountIdentifier(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      T70_EnumC14390b(param.type)
    ],
    [
      11,
      2,
      param.identifier
    ],
    [
      11,
      11,
      param.countryCode
    ]
  ];
}
export function h80_t(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.newDevicePublicKey
    ],
    [
      11,
      2,
      param.encryptedQrIdentifier
    ]
  ];
}
export function CheckIfEncryptedE2EEKeyReceivedRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ],
    [
      12,
      2,
      h80_t(param.secureChannelData)
    ]
  ];
}
export function UserPhoneNumber(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.phoneNumber
    ],
    [
      11,
      2,
      param.countryCode
    ]
  ];
}
export function CheckIfPhonePinCodeMsgVerifiedRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      UserPhoneNumber(param.userPhoneNumber)
    ]
  ];
}
export function r80_EnumC34368h(param) {
  return typeof param === "string" ? LINETypes.enums.r80_EnumC34368h[param] : param;
}
export function r80_EnumC34371k(param) {
  return typeof param === "string" ? LINETypes.enums.r80_EnumC34371k[param] : param;
}
export function CheckUserAgeAfterApprovalWithDocomoV2Request(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.accessToken
    ],
    [
      11,
      2,
      param.agprm
    ]
  ];
}
export function CheckUserAgeWithDocomoV2Request(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authCode
    ]
  ];
}
export function CarrierCode(param) {
  return typeof param === "string" ? LINETypes.enums.CarrierCode[param] : param;
}
export function IdentityProvider(param) {
  return typeof param === "string" ? LINETypes.enums.IdentityProvider[param] : param;
}
export function IdentifierConfirmationRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      13,
      1,
      [
        11,
        11,
        param.metaData
      ]
    ],
    [
      2,
      2,
      param.forceRegistration
    ],
    [
      11,
      3,
      param.verificationCode
    ]
  ];
}
export function IdentityCredentialRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      13,
      1,
      [
        11,
        11,
        param.metaData
      ]
    ],
    [
      8,
      2,
      IdentityProvider(param.identityProvider)
    ],
    [
      11,
      3,
      param.cipherKeyId
    ],
    [
      11,
      4,
      param.cipherText
    ],
    [
      12,
      5,
      IdentifierConfirmationRequest(param.confirmationRequest)
    ]
  ];
}
export function ConnectEapAccountRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ]
  ];
}
export function Pb1_X2(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_X2[param] : param;
}
export function ChatRoomAnnouncementContentMetadata(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.replace
    ],
    [
      11,
      2,
      param.sticonOwnership
    ],
    [
      11,
      3,
      param.postNotificationMetadata
    ]
  ];
}
export function ChatRoomAnnouncementContents(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.displayFields
    ],
    [
      11,
      2,
      param.text
    ],
    [
      11,
      3,
      param.link
    ],
    [
      11,
      4,
      param.thumbnail
    ],
    [
      12,
      5,
      ChatRoomAnnouncementContentMetadata(param.contentMetadata)
    ]
  ];
}
export function Pb1_Z2(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_Z2[param] : param;
}
export function CreateChatRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      8,
      2,
      Pb1_Z2(param.type)
    ],
    [
      11,
      3,
      param.name
    ],
    [
      14,
      4,
      [
        11,
        param.targetUserMids
      ]
    ],
    [
      11,
      5,
      param.picturePath
    ]
  ];
}
export function Pb1_A3(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_A3[param] : param;
}
export function Pb1_C13263z3(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.blobHeader
    ],
    [
      11,
      2,
      param.blobPayload
    ],
    [
      8,
      3,
      Pb1_A3(param.reason)
    ]
  ];
}
export function CreateGroupCallUrlRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.title
    ]
  ];
}
export function E2EEMetadata(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      1,
      param.e2EEPublicKeyId
    ]
  ];
}
export function SingleValueMetadata(param) {
  return typeof param === "undefined" ? [] : [];
}
export function Pb1_W5(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      E2EEMetadata(param.e2ee)
    ],
    [
      12,
      2,
      SingleValueMetadata(param.singleValue)
    ]
  ];
}
export function Pb1_X5(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Pb1_W5(param.metadata)
    ],
    [
      11,
      2,
      param.blobPayload
    ]
  ];
}
export function Pb1_E3(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.blobHeader
    ],
    [
      15,
      2,
      [
        12,
        param.payloadDataList && param.payloadDataList.map((e)=>Pb1_X5(e))
      ]
    ]
  ];
}
export function CreateMultiProfileRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.displayName
    ]
  ];
}
export function h80_C25643c(param) {
  return typeof param === "undefined" ? [] : [];
}
export function Pb1_H3(param) {
  return typeof param === "undefined" ? [] : [];
}
export function DeleteGroupCallUrlRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.urlId
    ]
  ];
}
export function DeleteMultiProfileRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.profileId
    ]
  ];
}
export function DeleteOtherFromChatRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.chatMid
    ],
    [
      14,
      3,
      [
        11,
        param.targetUserMids
      ]
    ]
  ];
}
export function R70_c(param) {
  return typeof param === "undefined" ? [] : [];
}
export function DeleteSafetyStatusRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.disasterId
    ]
  ];
}
export function DeleteSelfFromChatRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.chatMid
    ],
    [
      10,
      3,
      param.lastSeenMessageDeliveredTime
    ],
    [
      11,
      4,
      param.lastSeenMessageId
    ],
    [
      10,
      5,
      param.lastMessageDeliveredTime
    ],
    [
      11,
      6,
      param.lastMessageId
    ]
  ];
}
export function DetermineMediaMessageFlowRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ]
  ];
}
export function Q70_q(param) {
  return typeof param === "string" ? LINETypes.enums.Q70_q[param] : param;
}
export function DisconnectEapAccountRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Q70_q(param.eapType)
    ]
  ];
}
export function S70_b(param) {
  return typeof param === "undefined" ? [] : [];
}
export function FetchOperationsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.deviceId
    ],
    [
      10,
      2,
      param.offsetFrom
    ]
  ];
}
export function FetchPhonePinCodeMsgRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      UserPhoneNumber(param.userPhoneNumber)
    ]
  ];
}
export function Pb1_F0(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_F0[param] : param;
}
export function FindChatByTicketRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.ticketId
    ]
  ];
}
export function FollowRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Pb1_A4(param.followMid)
    ]
  ];
}
export function GetAccessTokenRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.fontId
    ]
  ];
}
export function GetAllChatMidsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      2,
      1,
      param.withMemberChats
    ],
    [
      2,
      2,
      param.withInvitedChats
    ]
  ];
}
export function Pb1_V7(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_V7[param] : param;
}
export function m80_l(param) {
  return typeof param === "undefined" ? [] : [];
}
export function m80_n(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LatestProductsByAuthorRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Ob1_O0(param.productType)
    ],
    [
      10,
      2,
      param.authorId
    ],
    [
      8,
      3,
      param.limit
    ]
  ];
}
export function Ob1_a2(param) {
  return typeof param === "string" ? LINETypes.enums.Ob1_a2[param] : param;
}
export function AutoSuggestionShowcaseRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Ob1_O0(param.productType)
    ],
    [
      8,
      2,
      Ob1_a2(param.suggestionType)
    ]
  ];
}
export function NZ0_C12208u(param) {
  return typeof param === "undefined" ? [] : [];
}
export function NZ0_C12214w(param) {
  return typeof param === "undefined" ? [] : [];
}
export function ZQ0_b(param) {
  return typeof param === "undefined" ? [] : [];
}
export function UEN(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      1,
      param.revision
    ]
  ];
}
export function Beacon(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.hardwareId
    ]
  ];
}
export function Uf_C14856C(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UEN(param.uen)
    ],
    [
      12,
      2,
      Beacon(param.beacon)
    ]
  ];
}
export function AdRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      13,
      1,
      [
        11,
        11,
        param.headers
      ]
    ],
    [
      13,
      2,
      [
        11,
        11,
        param.queryParams
      ]
    ]
  ];
}
export function Uf_EnumC14873o(param) {
  return typeof param === "string" ? LINETypes.enums.Uf_EnumC14873o[param] : param;
}
export function ContentRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Uf_EnumC14873o(param.os)
    ],
    [
      11,
      2,
      param.appv
    ],
    [
      11,
      3,
      param.lineAcceptableLanguage
    ],
    [
      11,
      4,
      param.countryCode
    ]
  ];
}
export function BannerRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      2,
      1,
      param.test
    ],
    [
      12,
      2,
      Uf_C14856C(param.trigger)
    ],
    [
      12,
      3,
      AdRequest(param.ad)
    ],
    [
      12,
      4,
      ContentRequest(param.content)
    ]
  ];
}
export function Eh_C8933a(param) {
  return typeof param === "undefined" ? [] : [];
}
export function GetBleDeviceRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.serviceUuid
    ],
    [
      11,
      2,
      param.psdi
    ]
  ];
}
export function GetBuddyChatBarRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.buddyMid
    ],
    [
      10,
      2,
      param.chatBarRevision
    ],
    [
      11,
      3,
      param.richMenuId
    ]
  ];
}
export function Pb1_D0(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_D0[param] : param;
}
export function GetBuddyLiveRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.mid
    ]
  ];
}
export function GetBuddyStatusBarV2Request(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.botMid
    ],
    [
      10,
      2,
      param.revision
    ]
  ];
}
export function GetCallStatusRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.basicSearchId
    ],
    [
      11,
      2,
      param.otp
    ]
  ];
}
export function GetCampaignRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.campaignType
    ]
  ];
}
export function GetChallengeForPaakAuthRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ]
  ];
}
export function GetChallengeForPrimaryRegRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ]
  ];
}
export function GetChannelContextRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ]
  ];
}
export function Pb1_Q2(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_Q2[param] : param;
}
export function GetChatappRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatappId
    ],
    [
      11,
      2,
      param.language
    ]
  ];
}
export function GetChatsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        11,
        param.chatMids
      ]
    ],
    [
      2,
      2,
      param.withMembers
    ],
    [
      2,
      3,
      param.withInvitees
    ]
  ];
}
export function jO0_EnumC27533B(param) {
  return typeof param === "string" ? LINETypes.enums.jO0_EnumC27533B[param] : param;
}
export function jO0_EnumC27559z(param) {
  return typeof param === "string" ? LINETypes.enums.jO0_EnumC27559z[param] : param;
}
export function GetCoinProductsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      jO0_EnumC27533B(param.appStoreCode)
    ],
    [
      11,
      2,
      param.country
    ],
    [
      11,
      3,
      param.language
    ],
    [
      8,
      4,
      jO0_EnumC27559z(param.pgCode)
    ]
  ];
}
export function GetCoinHistoryRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      jO0_EnumC27533B(param.appStoreCode)
    ],
    [
      11,
      2,
      param.country
    ],
    [
      11,
      3,
      param.language
    ],
    [
      11,
      4,
      param.searchEndDate
    ],
    [
      8,
      5,
      param.offset
    ],
    [
      8,
      6,
      param.limit
    ]
  ];
}
export function GetContactCalendarEventTarget(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.targetUserMid
    ]
  ];
}
export function GetContactCalendarEventsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        12,
        param.targetUsers && param.targetUsers.map((e)=>GetContactCalendarEventTarget(e))
      ]
    ],
    [
      8,
      2,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function GetContactV3Target(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.targetUserMid
    ]
  ];
}
export function GetContactsV3Request(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        12,
        param.targetUsers && param.targetUsers.map((e)=>GetContactV3Target(e))
      ]
    ],
    [
      8,
      2,
      Pb1_V7(param.syncReason)
    ],
    [
      2,
      3,
      param.checkUserStatusStrictly
    ]
  ];
}
export function Pb1_EnumC13221w3(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_EnumC13221w3[param] : param;
}
export function SimCard(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.countryCode
    ],
    [
      11,
      2,
      param.hni
    ],
    [
      11,
      3,
      param.carrierName
    ]
  ];
}
export function fN0_C24473e(param) {
  return typeof param === "undefined" ? [] : [];
}
export function DestinationLIFFRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.originalUrl
    ]
  ];
}
export function vh_C37633d(param) {
  return typeof param === "undefined" ? [] : [];
}
export function Pb1_W4(param) {
  return typeof param === "undefined" ? [] : [];
}
export function Pb1_Y4(param) {
  return typeof param === "undefined" ? [] : [];
}
export function GetExchangeKeyRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ]
  ];
}
export function GetFollowBlacklistRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.cursor
    ]
  ];
}
export function GetFollowersRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Pb1_A4(param.followMid)
    ],
    [
      11,
      2,
      param.cursor
    ]
  ];
}
export function GetFollowingsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Pb1_A4(param.followMid)
    ],
    [
      11,
      2,
      param.cursor
    ]
  ];
}
export function VR0_l(param) {
  return typeof param === "string" ? LINETypes.enums.VR0_l[param] : param;
}
export function GetFontMetasRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      VR0_l(param.requestCause)
    ]
  ];
}
export function GetFriendDetailTarget(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.targetUserMid
    ]
  ];
}
export function GetFriendDetailsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        12,
        param.targetUsers && param.targetUsers.map((e)=>GetFriendDetailTarget(e))
      ]
    ],
    [
      8,
      2,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function Pb1_F4(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_F4[param] : param;
}
export function GetGnbBadgeStatusRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.uenRevision
    ]
  ];
}
export function GetGroupCallUrlInfoRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.urlId
    ]
  ];
}
export function Pb1_C13042j5(param) {
  return typeof param === "undefined" ? [] : [];
}
export function GetHomeFlexContentRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.supportedFlexVersion
    ]
  ];
}
export function Eg_C8928b(param) {
  return typeof param === "undefined" ? [] : [];
}
export function GetHomeServicesRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        8,
        param.ids
      ]
    ]
  ];
}
export function fN0_C24471c(param) {
  return typeof param === "undefined" ? [] : [];
}
export function GetJoinedMembershipByBotMidRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.botMid
    ]
  ];
}
export function GetJoinedMembershipRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.uniqueKey
    ]
  ];
}
export function Pb1_C13070l5(param) {
  return typeof param === "undefined" ? [] : [];
}
export function LiffViewWithoutUserContextRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.liffId
    ]
  ];
}
export function r80_EnumC34372l(param) {
  return typeof param === "string" ? LINETypes.enums.r80_EnumC34372l[param] : param;
}
export function GetLoginActorContextRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ]
  ];
}
export function GetMappedProfileIdsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        11,
        param.targetUserMids
      ]
    ]
  ];
}
export function MessageBoxListRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.minChatId
    ],
    [
      11,
      2,
      param.maxChatId
    ],
    [
      2,
      3,
      param.activeOnly
    ],
    [
      8,
      4,
      param.messageBoxCountLimit
    ],
    [
      2,
      5,
      param.withUnreadCount
    ],
    [
      8,
      6,
      param.lastMessagesPerMessageBoxCount
    ],
    [
      2,
      7,
      param.unreadOnly
    ]
  ];
}
export function GetModuleLayoutV4Request(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.etag
    ]
  ];
}
export function NZ0_G(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.id
    ],
    [
      11,
      2,
      param.etag
    ],
    [
      11,
      3,
      param.recommendedModelId
    ],
    [
      11,
      4,
      param.deviceAdId
    ],
    [
      2,
      5,
      param.agreedWithTargetingAdByMid
    ],
    [
      11,
      6,
      param.deviceId
    ]
  ];
}
export function NZ0_E(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.id
    ],
    [
      11,
      2,
      param.etag
    ],
    [
      11,
      3,
      param.recommendedModelId
    ],
    [
      11,
      4,
      param.deviceAdId
    ],
    [
      2,
      5,
      param.agreedWithTargetingAdByMid
    ],
    [
      11,
      6,
      param.deviceId
    ]
  ];
}
export function GetModulesRequestV2(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.etag
    ],
    [
      11,
      2,
      param.deviceAdId
    ]
  ];
}
export function NZ0_EnumC12169g1(param) {
  return typeof param === "string" ? LINETypes.enums.NZ0_EnumC12169g1[param] : param;
}
export function GetModulesRequestV3(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.etag
    ],
    [
      8,
      2,
      NZ0_EnumC12169g1(param.tabIdentifier)
    ],
    [
      11,
      3,
      param.deviceAdId
    ],
    [
      2,
      4,
      param.agreedWithTargetingAdByMid
    ]
  ];
}
export function GetModulesV4WithStatusRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.etag
    ],
    [
      11,
      2,
      param.subTabId
    ],
    [
      11,
      3,
      param.deviceAdId
    ],
    [
      2,
      4,
      param.agreedWithTargetingAdByMid
    ],
    [
      11,
      5,
      param.deviceId
    ]
  ];
}
export function GetMyAssetInformationV2Request(param) {
  return typeof param === "undefined" ? [] : [
    [
      2,
      1,
      param.refresh
    ]
  ];
}
export function GetMyChatappsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.language
    ],
    [
      11,
      2,
      param.continuationToken
    ]
  ];
}
export function GetMyDashboardRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      NZ0_EnumC12169g1(param.tabIdentifier)
    ]
  ];
}
export function GetNotificationSettingsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      1,
      [
        11,
        param.chatMids
      ]
    ],
    [
      8,
      2,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function GetPasswordHashingParametersRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ]
  ];
}
export function GetPasswordHashingParametersForPwdRegRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ]
  ];
}
export function GetPasswordHashingParametersForPwdVerifRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      AccountIdentifier(param.accountIdentifier)
    ]
  ];
}
export function Device(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.udid
    ],
    [
      11,
      2,
      param.deviceModel
    ]
  ];
}
export function GetPhoneVerifMethodForRegistrationRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      Device(param.device)
    ],
    [
      12,
      3,
      UserPhoneNumber(param.userPhoneNumber)
    ]
  ];
}
export function GetPhoneVerifMethodV2Request(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      Device(param.device)
    ],
    [
      12,
      3,
      UserPhoneNumber(param.userPhoneNumber)
    ]
  ];
}
export function Pb1_C13126p5(param) {
  return typeof param === "undefined" ? [] : [];
}
export function GetPredefinedScenarioSetsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        11,
        param.deviceIds
      ]
    ]
  ];
}
export function fN0_C24475g(param) {
  return typeof param === "undefined" ? [] : [];
}
export function fN0_C24476h(param) {
  return typeof param === "undefined" ? [] : [];
}
export function MessageBoxV2MessageId(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      1,
      param.deliveredTime
    ],
    [
      10,
      2,
      param.messageId
    ]
  ];
}
export function GetPreviousMessagesV2Request(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.messageBoxId
    ],
    [
      12,
      2,
      MessageBoxV2MessageId(param.endMessageId)
    ],
    [
      8,
      3,
      param.messagesCount
    ],
    [
      2,
      4,
      param.withReadCount
    ],
    [
      2,
      5,
      param.receivedOnly
    ]
  ];
}
export function GetPublishedMembershipsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.basicSearchId
    ]
  ];
}
export function PurchaseEnabledRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.uniqueKey
    ]
  ];
}
export function NZ0_S(param) {
  return typeof param === "undefined" ? [] : [];
}
export function GetRecommendationDetailTarget(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.targetUserMid
    ]
  ];
}
export function GetRecommendationDetailsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        12,
        param.targetUsers && param.targetUsers.map((e)=>GetRecommendationDetailTarget(e))
      ]
    ],
    [
      8,
      2,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function ConfigurationsParams(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.regionOfUsim
    ],
    [
      11,
      2,
      param.regionOfTelephone
    ],
    [
      11,
      3,
      param.regionOfLocale
    ],
    [
      11,
      4,
      param.carrier
    ]
  ];
}
export function RepairGroupMembers(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.numMembers
    ],
    [
      2,
      3,
      param.invalidGroup
    ]
  ];
}
export function GetRepairElementsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      2,
      1,
      param.profile
    ],
    [
      2,
      2,
      param.settings
    ],
    [
      12,
      3,
      ConfigurationsParams(param.configurations)
    ],
    [
      8,
      4,
      param.numLocalJoinedGroups
    ],
    [
      8,
      5,
      param.numLocalInvitedGroups
    ],
    [
      8,
      6,
      param.numLocalFriends
    ],
    [
      8,
      7,
      param.numLocalRecommendations
    ],
    [
      8,
      8,
      param.numLocalBlockedFriends
    ],
    [
      8,
      9,
      param.numLocalBlockedRecommendations
    ],
    [
      13,
      10,
      [
        11,
        12,
        map(RepairGroupMembers, param.localGroupMembers)
      ]
    ],
    [
      8,
      11,
      Pb1_V7(param.syncReason)
    ],
    [
      13,
      12,
      [
        11,
        8,
        param.localProfileMappings
      ]
    ]
  ];
}
export function GetResponseStatusRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.botMid
    ]
  ];
}
export function WebLoginRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.hookedFullUrl
    ],
    [
      11,
      2,
      param.sessionString
    ],
    [
      2,
      3,
      param.fromIAB
    ],
    [
      11,
      4,
      param.sourceApplication
    ]
  ];
}
export function LiffChatContext(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ]
  ];
}
export function LiffSquareChatContext(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.squareChatMid
    ]
  ];
}
export function Qj_C13595l(param) {
  return typeof param === "undefined" ? [] : [
    ,
    [
      12,
      2,
      LiffChatContext(param.chat)
    ],
    [
      12,
      3,
      LiffSquareChatContext(param.squareChat)
    ]
  ];
}
export function Qj_EnumC13584a(param) {
  return typeof param === "string" ? LINETypes.enums.Qj_EnumC13584a[param] : param;
}
export function SKAdNetwork(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.identifiers
    ],
    [
      11,
      2,
      param.version
    ]
  ];
}
export function LiffAdvertisingId(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.advertisingId
    ],
    [
      2,
      2,
      param.tracking
    ],
    [
      8,
      3,
      Qj_EnumC13584a(param.att)
    ],
    [
      12,
      4,
      SKAdNetwork(param.skAdNetwork)
    ]
  ];
}
export function LiffDeviceSetting(param) {
  return typeof param === "undefined" ? [] : [
    [
      2,
      1,
      param.videoAutoPlayAllowed
    ],
    [
      12,
      2,
      LiffAdvertisingId(param.advertisingId)
    ]
  ];
}
export function LiffWebLoginRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.hookedFullUrl
    ],
    [
      11,
      2,
      param.sessionString
    ],
    [
      12,
      3,
      Qj_C13595l(param.context)
    ],
    [
      12,
      4,
      LiffDeviceSetting(param.deviceSetting)
    ]
  ];
}
export function GetSCCRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.basicSearchId
    ]
  ];
}
export function Eh_C8935c(param) {
  return typeof param === "undefined" ? [] : [];
}
export function NZ0_U(param) {
  return typeof param === "undefined" ? [] : [];
}
export function SettingsAttributeEx(param) {
  return typeof param === "string" ? LINETypes.enums.SettingsAttributeEx[param] : param;
}
export function GetSmartChannelRecommendationsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.maxResults
    ],
    [
      11,
      2,
      param.placement
    ],
    [
      2,
      3,
      param.testMode
    ]
  ];
}
export function GetSquareBotRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.botMid
    ]
  ];
}
export function Ob1_C12606a0(param) {
  return typeof param === "undefined" ? [] : [];
}
export function Ob1_K1(param) {
  return typeof param === "string" ? LINETypes.enums.Ob1_K1[param] : param;
}
export function GetSubscriptionPlansRequest(param) {
  return typeof param === "undefined" ? [] : [
    ,
    [
      8,
      2,
      Ob1_K1(param.storeCode)
    ]
  ];
}
export function Ob1_C12618e0(param) {
  return typeof param === "undefined" ? [] : [
    ,
    [
      11,
      2,
      param.continuationToken
    ],
    [
      8,
      3,
      param.limit
    ],
    [
      8,
      4,
      Ob1_O0(param.productType)
    ]
  ];
}
export function GetSubscriptionStatusRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      2,
      1,
      param.includeOtherOwnedSubscriptions
    ]
  ];
}
export function Ob1_C12630i0(param) {
  return typeof param === "undefined" ? [] : [];
}
export function GetSuggestResourcesV2Request(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Ob1_O0(param.productType)
    ],
    [
      15,
      2,
      [
        11,
        param.productIds
      ]
    ]
  ];
}
export function GetTaiwanBankBalanceRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.accessToken
    ],
    [
      11,
      2,
      param.authorizationCode
    ],
    [
      11,
      3,
      param.codeVerifier
    ]
  ];
}
export function GetTargetProfileTarget(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.targetUserMid
    ]
  ];
}
export function GetTargetProfilesRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        12,
        param.targetUsers && param.targetUsers.map((e)=>GetTargetProfileTarget(e))
      ]
    ],
    [
      8,
      2,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function NZ0_C12150a0(param) {
  return typeof param === "undefined" ? [] : [];
}
export function GetThaiBankBalanceRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.deviceId
    ]
  ];
}
export function GetTotalCoinBalanceRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      jO0_EnumC27533B(param.appStoreCode)
    ]
  ];
}
export function ChannelIdWithLastUpdated(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.channelId
    ],
    [
      10,
      2,
      param.lastUpdated
    ]
  ];
}
export function GetUserCollectionsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      1,
      param.lastUpdatedTimeMillis
    ],
    [
      2,
      2,
      param.includeSummary
    ],
    [
      8,
      3,
      Ob1_O0(param.productType)
    ]
  ];
}
export function GetUserVectorRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.majorVersion
    ]
  ];
}
export function GetUsersMappedByProfileRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.profileId
    ],
    [
      8,
      2,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function InviteFriendsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.campaignId
    ],
    [
      15,
      2,
      [
        11,
        param.invitees
      ]
    ]
  ];
}
export function InviteIntoChatRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.chatMid
    ],
    [
      14,
      3,
      [
        11,
        param.targetUserMids
      ]
    ]
  ];
}
export function IsProductForCollectionsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Ob1_O0(param.productType)
    ],
    [
      11,
      2,
      param.productId
    ]
  ];
}
export function IsStickerAvailableForCombinationStickerRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.packageId
    ]
  ];
}
export function LiffViewRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.liffId
    ],
    [
      12,
      2,
      Qj_C13595l(param.context)
    ],
    [
      11,
      3,
      param.lang
    ],
    [
      12,
      4,
      LiffDeviceSetting(param.deviceSetting)
    ],
    [
      11,
      5,
      param.msit
    ],
    [
      2,
      6,
      param.subsequentLiff
    ],
    [
      11,
      7,
      param.domain
    ]
  ];
}
export function IssueBirthdayGiftTokenRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.recipientUserMid
    ]
  ];
}
export function IssueV3TokenForPrimaryRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.udid
    ],
    [
      11,
      2,
      param.systemDisplayName
    ],
    [
      11,
      3,
      param.modelName
    ]
  ];
}
export function JoinChatByCallUrlRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.urlId
    ],
    [
      8,
      2,
      param.reqSeq
    ]
  ];
}
export function KickoutFromGroupCallRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ],
    [
      15,
      2,
      [
        11,
        param.targetMids
      ]
    ]
  ];
}
export function DeviceLinkRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.deviceId
    ]
  ];
}
export function LookupAvailableEapRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ]
  ];
}
export function MapProfileToUsersRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.profileId
    ],
    [
      15,
      2,
      [
        11,
        param.targetMids
      ]
    ]
  ];
}
export function MigratePrimaryUsingQrCodeRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ],
    [
      11,
      2,
      param.nonce
    ]
  ];
}
export function NotifyChatAdEntryRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ],
    [
      11,
      2,
      param.scenarioId
    ],
    [
      11,
      3,
      param.sdata
    ]
  ];
}
export function do0_EnumC23148f(param) {
  return typeof param === "string" ? LINETypes.enums.do0_EnumC23148f[param] : param;
}
export function do0_EnumC23147e(param) {
  return typeof param === "string" ? LINETypes.enums.do0_EnumC23147e[param] : param;
}
export function NotifyDeviceConnectionRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.deviceId
    ],
    [
      11,
      2,
      param.connectionId
    ],
    [
      8,
      3,
      do0_EnumC23148f(param.connectionType)
    ],
    [
      8,
      4,
      do0_EnumC23147e(param.code)
    ],
    [
      11,
      5,
      param.errorReason
    ],
    [
      10,
      6,
      param.startTime
    ],
    [
      10,
      7,
      param.endTime
    ]
  ];
}
export function NotifyDeviceDisconnectionRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.deviceId
    ],
    [
      11,
      2,
      param.connectionId
    ],
    [
      10,
      4,
      param.disconnectedTime
    ]
  ];
}
export function kf_p(param) {
  return typeof param === "string" ? LINETypes.enums.kf_p[param] : param;
}
export function kf_o(param) {
  return typeof param === "string" ? LINETypes.enums.kf_o[param] : param;
}
export function OATalkroomEventContext(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      1,
      param.timestampMillis
    ],
    [
      11,
      2,
      param.botMid
    ],
    [
      11,
      3,
      param.userMid
    ],
    [
      8,
      4,
      kf_o(param.os)
    ],
    [
      11,
      5,
      param.osVersion
    ],
    [
      11,
      6,
      param.appVersion
    ],
    [
      11,
      7,
      param.region
    ]
  ];
}
export function kf_u(param) {
  return typeof param === "string" ? LINETypes.enums.kf_u[param] : param;
}
export function RichmenuCoordinates(param) {
  return typeof param === "undefined" ? [] : [
    [
      4,
      1,
      param.x
    ],
    [
      4,
      2,
      param.y
    ]
  ];
}
export function kf_r(param) {
  return typeof param === "string" ? LINETypes.enums.kf_r[param] : param;
}
export function RichmenuEvent(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      kf_u(param.type)
    ],
    [
      11,
      2,
      param.richmenuId
    ],
    [
      12,
      3,
      RichmenuCoordinates(param.coordinates)
    ],
    [
      8,
      4,
      param.areaIndex
    ],
    [
      11,
      5,
      param.clickUrl
    ],
    [
      8,
      6,
      kf_r(param.clickAction)
    ]
  ];
}
export function kf_x(param) {
  return typeof param === "string" ? LINETypes.enums.kf_x[param] : param;
}
export function kf_w(param) {
  return typeof param === "undefined" ? [] : [];
}
export function TalkroomEnterReferer(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.urlScheme
    ],
    [
      8,
      2,
      kf_x(param.type)
    ],
    [
      12,
      3,
      kf_w(param.content)
    ]
  ];
}
export function TalkroomEvent(param) {
  return typeof param === "undefined" ? [] : [
    ,
    [
      12,
      2,
      TalkroomEnterReferer(param.referer)
    ]
  ];
}
export function kf_m(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RichmenuEvent(param.richmenu)
    ],
    [
      12,
      2,
      TalkroomEvent(param.talkroom)
    ]
  ];
}
export function OATalkroomEvent(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.eventId
    ],
    [
      8,
      2,
      kf_p(param.type)
    ],
    [
      12,
      3,
      OATalkroomEventContext(param.context)
    ],
    [
      12,
      4,
      kf_m(param.content)
    ]
  ];
}
export function NotifyOATalkroomEventsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        12,
        param.events && param.events.map((e)=>OATalkroomEvent(e))
      ]
    ]
  ];
}
export function do0_G(param) {
  return typeof param === "string" ? LINETypes.enums.do0_G[param] : param;
}
export function do0_m0(param) {
  return typeof param === "undefined" ? [] : [];
}
export function do0_C23143a(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.bytes
    ]
  ];
}
export function do0_C23142E(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      do0_m0(param.voidResult)
    ],
    [
      12,
      2,
      do0_C23143a(param.binaryResult)
    ]
  ];
}
export function do0_F(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.scenarioId
    ],
    [
      11,
      2,
      param.deviceId
    ],
    [
      10,
      3,
      param.revision
    ],
    [
      10,
      4,
      param.startTime
    ],
    [
      10,
      5,
      param.endTime
    ],
    [
      8,
      6,
      do0_G(param.code)
    ],
    [
      11,
      7,
      param.errorReason
    ],
    [
      11,
      8,
      param.bleNotificationPayload
    ],
    [
      15,
      9,
      [
        12,
        param.actionResults && param.actionResults.map((e)=>do0_C23142E(e))
      ]
    ],
    [
      11,
      10,
      param.connectionId
    ]
  ];
}
export function NotifyScenarioExecutedRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      2,
      [
        12,
        param.scenarioResults && param.scenarioResults.map((e)=>do0_F(e))
      ]
    ]
  ];
}
export function ApplicationType(param) {
  return typeof param === "string" ? LINETypes.enums.ApplicationType[param] : param;
}
export function DeviceInfo(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.deviceName
    ],
    [
      11,
      2,
      param.systemName
    ],
    [
      11,
      3,
      param.systemVersion
    ],
    [
      11,
      4,
      param.model
    ],
    [
      11,
      5,
      param.webViewVersion
    ],
    [
      8,
      10,
      CarrierCode(param.carrierCode)
    ],
    [
      11,
      11,
      param.carrierName
    ],
    [
      8,
      20,
      ApplicationType(param.applicationType)
    ]
  ];
}
export function AuthSessionRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      13,
      1,
      [
        11,
        11,
        param.metaData
      ]
    ]
  ];
}
export function OpenSessionRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      13,
      1,
      [
        11,
        11,
        param.metaData
      ]
    ]
  ];
}
export function PermitLoginRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ],
    [
      13,
      2,
      [
        11,
        11,
        param.metaData
      ]
    ]
  ];
}
export function Price(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.currency
    ],
    [
      11,
      2,
      param.amount
    ],
    [
      11,
      3,
      param.priceString
    ]
  ];
}
export function PurchaseOrder(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.shopId
    ],
    [
      11,
      2,
      param.productId
    ],
    [
      11,
      5,
      param.recipientMid
    ],
    [
      12,
      11,
      Price(param.price)
    ],
    [
      2,
      12,
      param.enableLinePointAutoExchange
    ],
    [
      12,
      21,
      Locale(param.locale)
    ],
    [
      13,
      31,
      [
        11,
        11,
        param.presentAttributes
      ]
    ]
  ];
}
export function PurchaseSubscriptionRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.billingItemId
    ],
    ,
    [
      8,
      3,
      Ob1_K1(param.storeCode)
    ],
    [
      11,
      4,
      param.storeOrderId
    ],
    [
      2,
      5,
      param.outsideAppPurchase
    ],
    [
      2,
      6,
      param.unavailableItemPurchase
    ]
  ];
}
export function PutE2eeKeyRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ],
    [
      13,
      2,
      [
        11,
        11,
        param.e2eeKey
      ]
    ]
  ];
}
export function ReactRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      10,
      2,
      param.messageId
    ],
    [
      12,
      3,
      ReactionType(param.reactionType)
    ]
  ];
}
export function RefreshAccessTokenRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.refreshToken
    ]
  ];
}
export function RSAEncryptedPassword(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.encrypted
    ],
    [
      11,
      2,
      param.keyName
    ]
  ];
}
export function RegisterCampaignRewardRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.campaignId
    ]
  ];
}
export function Pb1_C13097n4(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.version
    ],
    [
      8,
      2,
      param.keyId
    ],
    [
      11,
      4,
      param.keyData
    ],
    [
      10,
      5,
      param.createdTime
    ]
  ];
}
export function Pb1_W6(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      12,
      2,
      Pb1_C13097n4(param.publicKey)
    ],
    [
      11,
      3,
      param.blobPayload
    ]
  ];
}
export function RegisterPrimaryCredentialRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ]
  ];
}
export function ReissueChatTicketRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.groupMid
    ]
  ];
}
export function RejectChatInvitationRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.chatMid
    ]
  ];
}
export function RemoveFollowerRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Pb1_A4(param.followMid)
    ]
  ];
}
export function RemoveFromFollowBlacklistRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Pb1_A4(param.followMid)
    ]
  ];
}
export function RemoveItemFromCollectionRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.collectionId
    ],
    [
      11,
      3,
      param.productId
    ],
    [
      11,
      4,
      param.itemId
    ]
  ];
}
export function RemoveProductFromSubscriptionSlotRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Ob1_O0(param.productType)
    ],
    [
      11,
      2,
      param.productId
    ],
    ,
    [
      14,
      4,
      [
        11,
        param.productIds
      ]
    ]
  ];
}
export function Pb1_EnumC13128p7(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_EnumC13128p7[param] : param;
}
export function AbuseMessage(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      1,
      param.messageId
    ],
    [
      11,
      2,
      param.message
    ],
    [
      11,
      3,
      param.senderMid
    ],
    [
      8,
      4,
      ContentType(param.contentType)
    ],
    [
      10,
      5,
      param.createdTime
    ],
    [
      13,
      6,
      [
        11,
        11,
        param.metadata
      ]
    ]
  ];
}
export function AbuseReport(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_EnumC13128p7(param.reportSource)
    ],
    [
      8,
      2,
      ApplicationType(param.applicationType)
    ],
    [
      15,
      3,
      [
        8,
        param.spammerReasons
      ]
    ],
    [
      15,
      4,
      [
        12,
        param.abuseMessages && param.abuseMessages.map((e)=>AbuseMessage(e))
      ]
    ],
    [
      13,
      5,
      [
        11,
        11,
        param.metadata
      ]
    ]
  ];
}
export function EvidenceId(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.spaceId
    ],
    [
      11,
      2,
      param.objectId
    ]
  ];
}
export function AbuseReportLineMeeting(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.reporteeMid
    ],
    [
      15,
      2,
      [
        8,
        param.spammerReasons
      ]
    ],
    [
      15,
      3,
      [
        12,
        param.evidenceIds && param.evidenceIds.map((e)=>EvidenceId(e))
      ]
    ],
    [
      11,
      4,
      param.chatMid
    ]
  ];
}
export function Pb1_C12938c(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      AbuseReport(param.message)
    ],
    [
      12,
      2,
      AbuseReportLineMeeting(param.lineMeeting)
    ]
  ];
}
export function ReportAbuseExRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Pb1_C12938c(param.abuseReportEntry)
    ]
  ];
}
export function BeaconData(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.hwid
    ],
    [
      8,
      2,
      param.rssi
    ],
    [
      8,
      3,
      param.txPower
    ],
    [
      10,
      4,
      param.scannedTimestampMs
    ]
  ];
}
export function Geolocation(param) {
  return typeof param === "undefined" ? [] : [
    [
      4,
      1,
      param.longitude
    ],
    [
      4,
      2,
      param.latitude
    ],
    [
      12,
      3,
      GeolocationAccuracy(param.accuracy)
    ],
    [
      4,
      4,
      param.altitudeMeters
    ],
    [
      4,
      5,
      param.velocityMetersPerSecond
    ],
    [
      4,
      6,
      param.bearingDegrees
    ],
    [
      15,
      7,
      [
        12,
        param.beaconData && param.beaconData.map((e)=>BeaconData(e))
      ]
    ]
  ];
}
export function Pb1_EnumC12917a6(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_EnumC12917a6[param] : param;
}
export function Pb1_EnumC12998g3(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_EnumC12998g3[param] : param;
}
export function WifiSignal(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.ssid
    ],
    [
      11,
      3,
      param.bssid
    ],
    [
      11,
      4,
      param.wifiStandard
    ],
    [
      4,
      5,
      param.frequency
    ],
    [
      10,
      10,
      param.lastSeenTimestamp
    ],
    [
      8,
      11,
      param.rssi
    ]
  ];
}
export function ClientNetworkStatus(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_EnumC12998g3(param.networkType)
    ],
    [
      15,
      2,
      [
        12,
        param.wifiSignals && param.wifiSignals.map((e)=>WifiSignal(e))
      ]
    ]
  ];
}
export function Pb1_F6(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_F6[param] : param;
}
export function PoiInfo(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.poiId
    ],
    [
      8,
      2,
      Pb1_F6(param.poiRealm)
    ]
  ];
}
export function LocationDebugInfo(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      PoiInfo(param.poiInfo)
    ]
  ];
}
export function AvatarProfile(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.version
    ],
    [
      10,
      2,
      param.updatedMillis
    ],
    [
      11,
      3,
      param.thumbnail
    ],
    [
      2,
      4,
      param.usablePublicly
    ]
  ];
}
export function Pb1_N6(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_N6[param] : param;
}
export function Pb1_O6(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_O6[param] : param;
}
export function Profile(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.mid
    ],
    [
      11,
      3,
      param.userid
    ],
    [
      11,
      10,
      param.phone
    ],
    [
      11,
      11,
      param.email
    ],
    [
      11,
      12,
      param.regionCode
    ],
    [
      11,
      20,
      param.displayName
    ],
    [
      11,
      21,
      param.phoneticName
    ],
    [
      11,
      22,
      param.pictureStatus
    ],
    [
      11,
      23,
      param.thumbnailUrl
    ],
    [
      11,
      24,
      param.statusMessage
    ],
    [
      2,
      31,
      param.allowSearchByUserid
    ],
    [
      2,
      32,
      param.allowSearchByEmail
    ],
    [
      11,
      33,
      param.picturePath
    ],
    [
      11,
      34,
      param.musicProfile
    ],
    [
      11,
      35,
      param.videoProfile
    ],
    [
      13,
      36,
      [
        11,
        11,
        param.statusMessageContentMetadata
      ]
    ],
    [
      12,
      37,
      AvatarProfile(param.avatarProfile)
    ],
    [
      2,
      38,
      param.nftProfile
    ],
    [
      8,
      39,
      Pb1_N6(param.pictureSource)
    ],
    [
      11,
      40,
      param.profileId
    ],
    [
      8,
      41,
      Pb1_O6(param.profileType)
    ],
    [
      10,
      42,
      param.createdTimeMillis
    ]
  ];
}
export function Pb1_EnumC13009h0(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_EnumC13009h0[param] : param;
}
export function PushRecvReport(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.pushTrackingId
    ],
    [
      10,
      2,
      param.recvTimestamp
    ],
    [
      8,
      3,
      param.battery
    ],
    [
      8,
      4,
      Pb1_EnumC13009h0(param.batteryMode)
    ],
    [
      8,
      5,
      Pb1_EnumC12998g3(param.clientNetworkType)
    ],
    [
      11,
      6,
      param.carrierCode
    ],
    [
      10,
      7,
      param.displayTimestamp
    ]
  ];
}
export function ReportRefreshedAccessTokenRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.accessToken
    ]
  ];
}
export function EmailConfirmationStatus(param) {
  return typeof param === "string" ? LINETypes.enums.EmailConfirmationStatus[param] : param;
}
export function AccountMigrationPincodeType(param) {
  return typeof param === "string" ? LINETypes.enums.AccountMigrationPincodeType[param] : param;
}
export function Pb1_I6(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_I6[param] : param;
}
export function Pb1_S7(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_S7[param] : param;
}
export function Pb1_M6(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_M6[param] : param;
}
export function Pb1_gd(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_gd[param] : param;
}
export function Settings(param) {
  return typeof param === "undefined" ? [] : [
    [
      2,
      10,
      param.notificationEnable
    ],
    [
      10,
      11,
      param.notificationMuteExpiration
    ],
    [
      2,
      12,
      param.notificationNewMessage
    ],
    [
      2,
      13,
      param.notificationGroupInvitation
    ],
    [
      2,
      14,
      param.notificationShowMessage
    ],
    [
      2,
      15,
      param.notificationIncomingCall
    ],
    [
      11,
      16,
      param.notificationSoundMessage
    ],
    [
      11,
      17,
      param.notificationSoundGroup
    ],
    [
      2,
      18,
      param.notificationDisabledWithSub
    ],
    [
      2,
      19,
      param.notificationPayment
    ],
    [
      2,
      20,
      param.privacySyncContacts
    ],
    [
      2,
      21,
      param.privacySearchByPhoneNumber
    ],
    [
      2,
      22,
      param.privacySearchByUserid
    ],
    [
      2,
      23,
      param.privacySearchByEmail
    ],
    [
      2,
      24,
      param.privacyAllowSecondaryDeviceLogin
    ],
    [
      2,
      25,
      param.privacyProfileImagePostToMyhome
    ],
    [
      2,
      26,
      param.privacyReceiveMessagesFromNotFriend
    ],
    [
      2,
      27,
      param.privacyAgreeUseLineCoinToPaidCall
    ],
    [
      2,
      28,
      param.privacyAgreeUsePaidCall
    ],
    [
      2,
      29,
      param.privacyAllowFriendRequest
    ],
    [
      11,
      30,
      param.contactMyTicket
    ],
    [
      8,
      40,
      IdentityProvider(param.identityProvider)
    ],
    [
      11,
      41,
      param.identityIdentifier
    ],
    [
      13,
      42,
      [
        8,
        11,
        param.snsAccounts
      ]
    ],
    [
      2,
      43,
      param.phoneRegistration
    ],
    [
      8,
      44,
      EmailConfirmationStatus(param.emailConfirmationStatus)
    ],
    [
      8,
      45,
      AccountMigrationPincodeType(param.accountMigrationPincodeType)
    ],
    [
      2,
      46,
      param.enforcedInputAccountMigrationPincode
    ],
    [
      8,
      47,
      AccountMigrationPincodeType(param.securityCenterSettingsType)
    ],
    [
      2,
      48,
      param.allowUnregistrationSecondaryDevice
    ],
    [
      2,
      49,
      param.pwlessPrimaryCredentialRegistration
    ],
    [
      11,
      50,
      param.preferenceLocale
    ],
    [
      13,
      60,
      [
        8,
        11,
        param.customModes
      ]
    ],
    [
      2,
      61,
      param.e2eeEnable
    ],
    [
      2,
      62,
      param.hitokotoBackupRequested
    ],
    [
      2,
      63,
      param.privacyProfileMusicPostToMyhome
    ],
    [
      2,
      65,
      param.privacyAllowNearby
    ],
    [
      10,
      66,
      param.agreementNearbyTime
    ],
    [
      10,
      67,
      param.agreementSquareTime
    ],
    [
      2,
      68,
      param.notificationMention
    ],
    [
      10,
      69,
      param.botUseAgreementAcceptedAt
    ],
    [
      10,
      70,
      param.agreementShakeFunction
    ],
    [
      10,
      71,
      param.agreementMobileContactName
    ],
    [
      2,
      72,
      param.notificationThumbnail
    ],
    [
      10,
      73,
      param.agreementSoundToText
    ],
    [
      11,
      74,
      param.privacyPolicyVersion
    ],
    [
      10,
      75,
      param.agreementAdByWebAccess
    ],
    [
      10,
      76,
      param.agreementPhoneNumberMatching
    ],
    [
      10,
      77,
      param.agreementCommunicationInfo
    ],
    [
      8,
      78,
      Pb1_I6(param.privacySharePersonalInfoToFriends)
    ],
    [
      10,
      79,
      param.agreementThingsWirelessCommunication
    ],
    [
      10,
      80,
      param.agreementGdpr
    ],
    [
      8,
      81,
      Pb1_S7(param.privacyStatusMessageHistory)
    ],
    [
      10,
      82,
      param.agreementProvideLocation
    ],
    [
      10,
      83,
      param.agreementBeacon
    ],
    [
      8,
      85,
      Pb1_M6(param.privacyAllowProfileHistory)
    ],
    [
      10,
      86,
      param.agreementContentsSuggest
    ],
    [
      10,
      87,
      param.agreementContentsSuggestDataCollection
    ],
    [
      8,
      88,
      Pb1_gd(param.privacyAgeResult)
    ],
    [
      2,
      89,
      param.privacyAgeResultReceived
    ],
    [
      10,
      90,
      param.agreementOcrImageCollection
    ],
    [
      2,
      91,
      param.privacyAllowFollow
    ],
    [
      2,
      92,
      param.privacyShowFollowList
    ],
    [
      2,
      93,
      param.notificationBadgeTalkOnly
    ],
    [
      10,
      94,
      param.agreementIcna
    ],
    [
      2,
      95,
      param.notificationReaction
    ],
    [
      10,
      96,
      param.agreementMid
    ],
    [
      2,
      97,
      param.homeNotificationNewFriend
    ],
    [
      2,
      98,
      param.homeNotificationFavoriteFriendUpdate
    ],
    [
      2,
      99,
      param.homeNotificationGroupMemberUpdate
    ],
    [
      2,
      100,
      param.homeNotificationBirthday
    ],
    [
      13,
      101,
      [
        8,
        2,
        param.eapAllowedToConnect
      ]
    ],
    [
      10,
      102,
      param.agreementLineOutUse
    ],
    [
      10,
      103,
      param.agreementLineOutProvideInfo
    ],
    [
      2,
      104,
      param.notificationShowProfileImage
    ],
    [
      10,
      105,
      param.agreementPdpa
    ],
    [
      11,
      106,
      param.agreementLocationVersion
    ],
    [
      2,
      107,
      param.zhdPageAllowedToShow
    ],
    [
      10,
      108,
      param.agreementSnowAiAvatar
    ],
    [
      2,
      109,
      param.eapOnlyAccountTargetCountry
    ],
    [
      10,
      110,
      param.agreementLypPremiumAlbum
    ],
    [
      10,
      112,
      param.agreementLypPremiumAlbumVersion
    ],
    [
      10,
      113,
      param.agreementAlbumUsageData
    ],
    [
      10,
      114,
      param.agreementAlbumUsageDataVersion
    ],
    [
      10,
      115,
      param.agreementLypPremiumBackup
    ],
    [
      10,
      116,
      param.agreementLypPremiumBackupVersion
    ],
    [
      10,
      117,
      param.agreementOaAiAssistant
    ],
    [
      10,
      118,
      param.agreementOaAiAssistantVersion
    ],
    [
      10,
      119,
      param.agreementLypPremiumMultiProfile
    ],
    [
      10,
      120,
      param.agreementLypPremiumMultiProfileVersion
    ]
  ];
}
export function Pb1_od(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_od[param] : param;
}
export function T70_K(param) {
  return typeof param === "string" ? LINETypes.enums.T70_K[param] : param;
}
export function ReqToSendPhonePinCodeRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      UserPhoneNumber(param.userPhoneNumber)
    ],
    [
      8,
      3,
      T70_K(param.verifMethod)
    ]
  ];
}
export function r80_g0(param) {
  return typeof param === "string" ? LINETypes.enums.r80_g0[param] : param;
}
export function CoinPurchaseReservation(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.productId
    ],
    [
      11,
      2,
      param.country
    ],
    [
      11,
      3,
      param.currency
    ],
    [
      11,
      4,
      param.price
    ],
    [
      8,
      5,
      jO0_EnumC27533B(param.appStoreCode)
    ],
    [
      11,
      6,
      param.language
    ],
    [
      8,
      7,
      jO0_EnumC27559z(param.pgCode)
    ],
    [
      11,
      8,
      param.redirectUrl
    ]
  ];
}
export function fN0_G(param) {
  return typeof param === "string" ? LINETypes.enums.fN0_G[param] : param;
}
export function ReserveSubscriptionPurchaseRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.billingItemId
    ],
    [
      8,
      2,
      fN0_G(param.storeCode)
    ],
    [
      2,
      3,
      param.addOaFriend
    ],
    [
      11,
      4,
      param.entryPoint
    ],
    [
      11,
      5,
      param.campaignId
    ],
    [
      11,
      6,
      param.invitationId
    ]
  ];
}
export function ReserveRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.uniqueKey
    ]
  ];
}
export function Pb1_C13155r7(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.restoreClaim
    ]
  ];
}
export function Pb1_C13183t7(param) {
  return typeof param === "undefined" ? [] : [];
}
export function RevokeTokensRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        11,
        param.accessTokens
      ]
    ]
  ];
}
export function StudentInformation(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.schoolName
    ],
    [
      11,
      2,
      param.graduationDate
    ]
  ];
}
export function SaveStudentInformationRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      StudentInformation(param.studentInformation)
    ]
  ];
}
export function SendEncryptedE2EEKeyRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ]
  ];
}
export function SendPostbackRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.messageId
    ],
    [
      11,
      2,
      param.url
    ],
    [
      11,
      3,
      param.chatMID
    ],
    [
      11,
      4,
      param.originMID
    ]
  ];
}
export function SetChatHiddenStatusRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.chatMid
    ],
    [
      10,
      3,
      param.lastMessageId
    ],
    [
      2,
      4,
      param.hidden
    ]
  ];
}
export function SetHashedPasswordRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      11,
      2,
      param.password
    ]
  ];
}
export function SetPasswordRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ],
    [
      11,
      2,
      param.hashedPassword
    ]
  ];
}
export function Ob1_C12660s1(param) {
  return typeof param === "undefined" ? [] : [];
}
export function StartPhotoboothRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ]
  ];
}
export function SIMInfo(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.phoneNumber
    ],
    [
      11,
      2,
      param.countryCode
    ]
  ];
}
export function StopBundleSubscriptionRequest(param) {
  return typeof param === "undefined" ? [] : [
    ,
    [
      8,
      2,
      Ob1_K1(param.storeCode)
    ]
  ];
}
export function Qj_e0(param) {
  return typeof param === "string" ? LINETypes.enums.Qj_e0[param] : param;
}
export function ShareTargetPickerResultRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.ott
    ],
    [
      11,
      2,
      param.liffId
    ],
    [
      8,
      3,
      Qj_e0(param.resultCode)
    ],
    [
      11,
      4,
      param.resultDescription
    ]
  ];
}
export function SubWindowResultRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.msit
    ],
    [
      11,
      2,
      param.mstVerifier
    ]
  ];
}
export function Pb1_EnumC13029i6(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_EnumC13029i6[param] : param;
}
export function ContactModification(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_EnumC13029i6(param.type)
    ],
    [
      11,
      2,
      param.luid
    ],
    [
      15,
      11,
      [
        11,
        param.phones
      ]
    ],
    [
      15,
      12,
      [
        11,
        param.emails
      ]
    ],
    [
      15,
      13,
      [
        11,
        param.userids
      ]
    ],
    [
      11,
      14,
      param.mobileContactName
    ],
    [
      11,
      15,
      param.phoneticName
    ]
  ];
}
export function Pb1_J4(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_J4[param] : param;
}
export function SyncRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      1,
      param.lastRevision
    ],
    [
      8,
      2,
      param.count
    ],
    [
      10,
      3,
      param.lastGlobalRevision
    ],
    [
      10,
      4,
      param.lastIndividualRevision
    ],
    [
      8,
      5,
      Pb1_J4(param.fullSyncRequestReason)
    ],
    [
      13,
      6,
      [
        8,
        10,
        param.lastPartialFullSyncs
      ]
    ]
  ];
}
export function Pb1_G4(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_G4[param] : param;
}
export function UnfollowRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Pb1_A4(param.followMid)
    ]
  ];
}
export function DeviceUnlinkRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.deviceId
    ]
  ];
}
export function ChannelNotificationSetting(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.channelId
    ],
    [
      11,
      2,
      param.name
    ],
    [
      2,
      3,
      param.notificationReceivable
    ],
    [
      2,
      4,
      param.messageReceivable
    ],
    [
      2,
      5,
      param.showDefault
    ]
  ];
}
export function ChannelSettings(param) {
  return typeof param === "undefined" ? [] : [
    [
      2,
      1,
      param.unapprovedMessageReceivable
    ]
  ];
}
export function GroupExtra(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.creator
    ],
    [
      2,
      2,
      param.preventedJoinByTicket
    ],
    [
      11,
      3,
      param.invitationTicket
    ],
    [
      13,
      4,
      [
        11,
        10,
        param.memberMids
      ]
    ],
    [
      13,
      5,
      [
        11,
        10,
        param.inviteeMids
      ]
    ],
    [
      2,
      6,
      param.addFriendDisabled
    ],
    [
      2,
      7,
      param.ticketDisabled
    ],
    [
      2,
      8,
      param.autoName
    ]
  ];
}
export function Pb1_A6(param) {
  return typeof param === "undefined" ? [] : [];
}
export function Pb1_C13208v4(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GroupExtra(param.groupExtra)
    ],
    [
      12,
      2,
      Pb1_A6(param.peerExtra)
    ]
  ];
}
export function Chat(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_Z2(param.type)
    ],
    [
      11,
      2,
      param.chatMid
    ],
    [
      10,
      3,
      param.createdTime
    ],
    [
      2,
      4,
      param.notificationDisabled
    ],
    [
      10,
      5,
      param.favoriteTimestamp
    ],
    [
      11,
      6,
      param.chatName
    ],
    [
      11,
      7,
      param.picturePath
    ],
    [
      12,
      8,
      Pb1_C13208v4(param.extra)
    ]
  ];
}
export function Pb1_O2(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_O2[param] : param;
}
export function UpdateChatRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      12,
      2,
      Chat(param.chat)
    ],
    [
      8,
      3,
      Pb1_O2(param.updatedAttribute)
    ]
  ];
}
export function ContactSetting(param) {
  return typeof param === "string" ? LINETypes.enums.ContactSetting[param] : param;
}
export function Pb1_H6(param) {
  return typeof param === "string" ? LINETypes.enums.Pb1_H6[param] : param;
}
export function ExtendedProfileBirthday(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.year
    ],
    [
      8,
      2,
      Pb1_H6(param.yearPrivacyLevelType)
    ],
    [
      2,
      3,
      param.yearEnabled
    ],
    [
      11,
      5,
      param.day
    ],
    [
      8,
      6,
      Pb1_H6(param.dayPrivacyLevelType)
    ],
    [
      2,
      7,
      param.dayEnabled
    ]
  ];
}
export function ExtendedProfile(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ExtendedProfileBirthday(param.birthday)
    ]
  ];
}
export function Pb1_ad(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.title
    ]
  ];
}
export function UpdateGroupCallUrlRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.urlId
    ],
    [
      12,
      2,
      Pb1_ad(param.targetAttribute)
    ]
  ];
}
export function NotificationType(param) {
  return typeof param === "string" ? LINETypes.enums.NotificationType[param] : param;
}
export function UpdatePasswordRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ],
    [
      11,
      2,
      param.hashedPassword
    ]
  ];
}
export function ProfileContent(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.value
    ],
    [
      13,
      2,
      [
        11,
        11,
        param.meta
      ]
    ]
  ];
}
export function UpdateProfileAttributesRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      13,
      1,
      [
        8,
        12,
        map(ProfileContent, param.profileAttributes)
      ]
    ]
  ];
}
export function vh_m(param) {
  return typeof param === "string" ? LINETypes.enums.vh_m[param] : param;
}
export function UpdateSafetyStatusRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.disasterId
    ],
    [
      8,
      2,
      vh_m(param.safetyStatus)
    ],
    [
      11,
      3,
      param.message
    ]
  ];
}
export function UsePhotoboothTicketRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.chatMid
    ],
    [
      11,
      2,
      param.photoboothSessionId
    ]
  ];
}
export function r80_EnumC34376p(param) {
  return typeof param === "string" ? LINETypes.enums.r80_EnumC34376p[param] : param;
}
export function VerifyAccountUsingHashedPwdRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      AccountIdentifier(param.accountIdentifier)
    ],
    [
      11,
      3,
      param.v1HashedPassword
    ],
    [
      11,
      4,
      param.clientHashedPassword
    ]
  ];
}
export function VerifyAssertionRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ],
    [
      11,
      2,
      param.credentialId
    ],
    [
      11,
      3,
      param.assertionObject
    ],
    [
      11,
      4,
      param.clientDataJSON
    ]
  ];
}
export function VerifyAttestationRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.sessionId
    ],
    [
      11,
      2,
      param.attestationObject
    ],
    [
      11,
      3,
      param.clientDataJSON
    ]
  ];
}
export function BirthdayGiftAssociationVerifyRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.associationToken
    ]
  ];
}
export function T70_j1(param) {
  return typeof param === "string" ? LINETypes.enums.T70_j1[param] : param;
}
export function SocialLogin(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      T70_j1(param.type)
    ],
    [
      11,
      2,
      param.accessToken
    ],
    [
      11,
      3,
      param.countryCode
    ]
  ];
}
export function a80_EnumC16644b(param) {
  return typeof param === "string" ? LINETypes.enums.a80_EnumC16644b[param] : param;
}
export function EapLogin(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      a80_EnumC16644b(param.type)
    ],
    [
      11,
      2,
      param.accessToken
    ],
    [
      11,
      3,
      param.countryCode
    ]
  ];
}
export function VerifyEapLoginRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      EapLogin(param.eapLogin)
    ]
  ];
}
export function VerifyPhonePinCodeRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      UserPhoneNumber(param.userPhoneNumber)
    ],
    [
      11,
      3,
      param.pinCode
    ]
  ];
}
export function VerifyPinCodeRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.pinCode
    ]
  ];
}
export function VerifyQrCodeRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      13,
      2,
      [
        11,
        11,
        param.metaData
      ]
    ]
  ];
}
export function acceptChatInvitationByTicket_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      AcceptChatInvitationByTicketRequest(param.request)
    ]
  ];
}
export function acceptChatInvitation_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      AcceptChatInvitationRequest(param.request)
    ]
  ];
}
export function SquareService_acceptSpeakers_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      AcceptSpeakersRequest(param.request)
    ]
  ];
}
export function SquareService_acceptToChangeRole_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      AcceptToChangeRoleRequest(param.request)
    ]
  ];
}
export function SquareService_acceptToListen_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      AcceptToListenRequest(param.request)
    ]
  ];
}
export function SquareService_acceptToSpeak_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      AcceptToSpeakRequest(param.request)
    ]
  ];
}
export function SquareService_acquireLiveTalk_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      AcquireLiveTalkRequest(param.request)
    ]
  ];
}
export function SquareService_cancelToSpeak_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CancelToSpeakRequest(param.request)
    ]
  ];
}
export function SquareService_fetchLiveTalkEvents_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      FetchLiveTalkEventsRequest(param.request)
    ]
  ];
}
export function SquareService_findLiveTalkByInvitationTicket_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      FindLiveTalkByInvitationTicketRequest(param.request)
    ]
  ];
}
export function SquareService_forceEndLiveTalk_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ForceEndLiveTalkRequest(param.request)
    ]
  ];
}
export function SquareService_getLiveTalkInfoForNonMember_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetLiveTalkInfoForNonMemberRequest(param.request)
    ]
  ];
}
export function SquareService_getLiveTalkInvitationUrl_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetLiveTalkInvitationUrlRequest(param.request)
    ]
  ];
}
export function SquareService_getLiveTalkSpeakersForNonMember_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetLiveTalkSpeakersForNonMemberRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareInfoByChatMid_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareInfoByChatMidRequest(param.request)
    ]
  ];
}
export function SquareService_inviteToChangeRole_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      InviteToChangeRoleRequest(param.request)
    ]
  ];
}
export function SquareService_inviteToListen_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      InviteToListenRequest(param.request)
    ]
  ];
}
export function SquareService_inviteToLiveTalk_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      InviteToLiveTalkRequest(param.request)
    ]
  ];
}
export function SquareService_inviteToSpeak_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      InviteToSpeakRequest(param.request)
    ]
  ];
}
export function SquareService_joinLiveTalk_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      JoinLiveTalkRequest(param.request)
    ]
  ];
}
export function SquareService_kickOutLiveTalkParticipants_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      KickOutLiveTalkParticipantsRequest(param.request)
    ]
  ];
}
export function SquareService_rejectSpeakers_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RejectSpeakersRequest(param.request)
    ]
  ];
}
export function SquareService_rejectToSpeak_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RejectToSpeakRequest(param.request)
    ]
  ];
}
export function SquareService_removeLiveTalkSubscription_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RemoveLiveTalkSubscriptionRequest(param.request)
    ]
  ];
}
export function SquareService_reportLiveTalk_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ReportLiveTalkRequest(param.request)
    ]
  ];
}
export function SquareService_reportLiveTalkSpeaker_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ReportLiveTalkSpeakerRequest(param.request)
    ]
  ];
}
export function SquareService_requestToListen_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RequestToListenRequest(param.request)
    ]
  ];
}
export function SquareService_requestToSpeak_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RequestToSpeakRequest(param.request)
    ]
  ];
}
export function SquareService_updateLiveTalkAttrs_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UpdateLiveTalkAttrsRequest(param.request)
    ]
  ];
}
export function acquireCallRoute_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.to
    ],
    [
      8,
      3,
      Pb1_D4(param.callType)
    ],
    [
      13,
      4,
      [
        11,
        11,
        param.fromEnvInfo
      ]
    ]
  ];
}
export function acquireEncryptedAccessToken_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      2,
      Pb1_EnumC13222w4(param.featureType)
    ]
  ];
}
export function acquireGroupCallRoute_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.chatMid
    ],
    [
      8,
      3,
      Pb1_EnumC13237x5(param.mediaType)
    ],
    [
      2,
      4,
      param.isInitialHost
    ],
    [
      15,
      5,
      [
        11,
        param.capabilities
      ]
    ]
  ];
}
export function acquireOACallRoute_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      AcquireOACallRouteRequest(param.request)
    ]
  ];
}
export function acquirePaidCallRoute_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      2,
      PaidCallType(param.paidCallType)
    ],
    [
      11,
      3,
      param.dialedNumber
    ],
    [
      11,
      4,
      param.language
    ],
    [
      11,
      5,
      param.networkCode
    ],
    [
      2,
      6,
      param.disableCallerId
    ],
    [
      11,
      7,
      param.referer
    ],
    [
      11,
      8,
      param.adSessionId
    ]
  ];
}
export function activateSubscription_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ActivateSubscriptionRequest(param.request)
    ]
  ];
}
export function adTypeOptOutClickEvent_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      AdTypeOptOutClickEventRequest(param.request)
    ]
  ];
}
export function addFriendByMid_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      AddFriendByMidRequest(param.request)
    ]
  ];
}
export function addItemToCollection_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      AddItemToCollectionRequest(param.request)
    ]
  ];
}
export function addOaFriend_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      NZ0_C12155c(param.request)
    ]
  ];
}
export function addProductToSubscriptionSlot_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      AddProductToSubscriptionSlotRequest(param.req)
    ]
  ];
}
export function addThemeToSubscriptionSlot_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      AddThemeToSubscriptionSlotRequest(param.req)
    ]
  ];
}
export function addToFollowBlacklist_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      AddToFollowBlacklistRequest(param.addToFollowBlacklistRequest)
    ]
  ];
}
export function SquareService_agreeToTerms_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      AgreeToTermsRequest(param.request)
    ]
  ];
}
export function SquareService_approveSquareMembers_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ApproveSquareMembersRequest(param.request)
    ]
  ];
}
export function SquareService_checkJoinCode_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CheckJoinCodeRequest(param.request)
    ]
  ];
}
export function SquareService_createSquareChatAnnouncement_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CreateSquareChatAnnouncementRequest(param.createSquareChatAnnouncementRequest)
    ]
  ];
}
export function SquareService_createSquareChat_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CreateSquareChatRequest(param.request)
    ]
  ];
}
export function SquareService_createSquare_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CreateSquareRequest(param.request)
    ]
  ];
}
export function SquareService_deleteSquareChatAnnouncement_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      DeleteSquareChatAnnouncementRequest(param.deleteSquareChatAnnouncementRequest)
    ]
  ];
}
export function SquareService_deleteSquareChat_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      DeleteSquareChatRequest(param.request)
    ]
  ];
}
export function SquareService_deleteSquare_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      DeleteSquareRequest(param.request)
    ]
  ];
}
export function SquareService_destroyMessage_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      DestroyMessageRequest(param.request)
    ]
  ];
}
export function SquareService_destroyMessages_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      DestroyMessagesRequest(param.request)
    ]
  ];
}
export function SquareService_fetchMyEvents_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      FetchMyEventsRequest(param.request)
    ]
  ];
}
export function SquareService_fetchSquareChatEvents_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      FetchSquareChatEventsRequest(param.request)
    ]
  ];
}
export function SquareService_findSquareByEmid_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      FindSquareByEmidRequest(param.findSquareByEmidRequest)
    ]
  ];
}
export function SquareService_findSquareByInvitationTicket_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      FindSquareByInvitationTicketRequest(param.request)
    ]
  ];
}
export function SquareService_findSquareByInvitationTicketV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      FindSquareByInvitationTicketV2Request(param.request)
    ]
  ];
}
export function SquareService_getGoogleAdOptions_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetGoogleAdOptionsRequest(param.request)
    ]
  ];
}
export function SquareService_getInvitationTicketUrl_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetInvitationTicketUrlRequest(param.request)
    ]
  ];
}
export function SquareService_getJoinableSquareChats_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetJoinableSquareChatsRequest(param.request)
    ]
  ];
}
export function SquareService_getJoinedSquareChats_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetJoinedSquareChatsRequest(param.request)
    ]
  ];
}
export function SquareService_getJoinedSquares_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetJoinedSquaresRequest(param.request)
    ]
  ];
}
export function SquareService_getMessageReactions_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetMessageReactionsRequest(param.request)
    ]
  ];
}
export function SquareService_getNoteStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetNoteStatusRequest(param.request)
    ]
  ];
}
export function SquareService_getPopularKeywords_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetPopularKeywordsRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareAuthorities_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareAuthoritiesRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareAuthority_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareAuthorityRequest(param.request)
    ]
  ];
}
export function SquareService_getCategories_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareCategoriesRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareChatAnnouncements_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareChatAnnouncementsRequest(param.getSquareChatAnnouncementsRequest)
    ]
  ];
}
export function SquareService_getSquareChatEmid_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareChatEmidRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareChatFeatureSet_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareChatFeatureSetRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareChatMember_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareChatMemberRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareChatMembers_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareChatMembersRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareChat_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareChatRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareChatStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareChatStatusRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareEmid_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareEmidRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareFeatureSet_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareFeatureSetRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareMemberRelation_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareMemberRelationRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareMemberRelations_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareMemberRelationsRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareMember_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareMemberRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareMembersBySquare_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareMembersBySquareRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareMembers_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareMembersRequest(param.request)
    ]
  ];
}
export function SquareService_getSquare_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareStatusRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareThreadMid_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareThreadMidRequest(param.request)
    ]
  ];
}
export function SquareService_getSquareThread_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareThreadRequest(param.request)
    ]
  ];
}
export function SquareService_getUserSettings_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetUserSettingsRequest(param.request)
    ]
  ];
}
export function SquareService_hideSquareMemberContents_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      HideSquareMemberContentsRequest(param.request)
    ]
  ];
}
export function SquareService_inviteIntoSquareChat_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      InviteIntoSquareChatRequest(param.request)
    ]
  ];
}
export function SquareService_inviteToSquare_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      InviteToSquareRequest(param.request)
    ]
  ];
}
export function SquareService_joinSquareChat_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      JoinSquareChatRequest(param.request)
    ]
  ];
}
export function SquareService_joinSquare_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      JoinSquareRequest(param.request)
    ]
  ];
}
export function SquareService_joinSquareThread_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      JoinSquareThreadRequest(param.request)
    ]
  ];
}
export function SquareService_leaveSquareChat_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      LeaveSquareChatRequest(param.request)
    ]
  ];
}
export function SquareService_leaveSquare_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      LeaveSquareRequest(param.request)
    ]
  ];
}
export function SquareService_leaveSquareThread_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      LeaveSquareThreadRequest(param.request)
    ]
  ];
}
export function SquareService_manualRepair_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ManualRepairRequest(param.request)
    ]
  ];
}
export function SquareService_markAsRead_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      MarkAsReadRequest(param.request)
    ]
  ];
}
export function SquareService_markChatsAsRead_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      MarkChatsAsReadRequest(param.request)
    ]
  ];
}
export function SquareService_markThreadsAsRead_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      MarkThreadsAsReadRequest(param.request)
    ]
  ];
}
export function SquareService_reactToMessage_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ReactToMessageRequest(param.request)
    ]
  ];
}
export function SquareService_refreshSubscriptions_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RefreshSubscriptionsRequest(param.request)
    ]
  ];
}
export function SquareService_rejectSquareMembers_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RejectSquareMembersRequest(param.request)
    ]
  ];
}
export function SquareService_removeSubscriptions_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RemoveSubscriptionsRequest(param.request)
    ]
  ];
}
export function SquareService_reportMessageSummary_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ReportMessageSummaryRequest(param.request)
    ]
  ];
}
export function SquareService_reportSquareChat_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ReportSquareChatRequest(param.request)
    ]
  ];
}
export function SquareService_reportSquareMember_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ReportSquareMemberRequest(param.request)
    ]
  ];
}
export function SquareService_reportSquareMessage_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ReportSquareMessageRequest(param.request)
    ]
  ];
}
export function SquareService_reportSquare_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ReportSquareRequest(param.request)
    ]
  ];
}
export function SquareService_searchSquareChatMembers_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      SearchSquareChatMembersRequest(param.request)
    ]
  ];
}
export function SquareService_searchSquareChatMentionables_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      SearchSquareChatMentionablesRequest(param.request)
    ]
  ];
}
export function SquareService_searchSquareMembers_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      SearchSquareMembersRequest(param.request)
    ]
  ];
}
export function SquareService_searchSquares_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      SearchSquaresRequest(param.request)
    ]
  ];
}
export function SquareService_sendMessage_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      SendMessageRequest(param.request)
    ]
  ];
}
export function SquareService_sendSquareThreadMessage_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      SendSquareThreadMessageRequest(param.request)
    ]
  ];
}
export function SquareService_syncSquareMembers_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      SyncSquareMembersRequest(param.request)
    ]
  ];
}
export function SquareService_unhideSquareMemberContents_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UnhideSquareMemberContentsRequest(param.request)
    ]
  ];
}
export function SquareService_unsendMessage_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UnsendMessageRequest(param.request)
    ]
  ];
}
export function SquareService_updateSquareAuthority_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UpdateSquareAuthorityRequest(param.request)
    ]
  ];
}
export function SquareService_updateSquareChatMember_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UpdateSquareChatMemberRequest(param.request)
    ]
  ];
}
export function SquareService_updateSquareChat_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UpdateSquareChatRequest(param.request)
    ]
  ];
}
export function SquareService_updateSquareFeatureSet_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UpdateSquareFeatureSetRequest(param.request)
    ]
  ];
}
export function SquareService_updateSquareMemberRelation_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UpdateSquareMemberRelationRequest(param.request)
    ]
  ];
}
export function SquareService_updateSquareMember_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UpdateSquareMemberRequest(param.request)
    ]
  ];
}
export function SquareService_updateSquareMembers_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UpdateSquareMembersRequest(param.request)
    ]
  ];
}
export function SquareService_updateSquare_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UpdateSquareRequest(param.request)
    ]
  ];
}
export function SquareService_updateUserSettings_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UpdateUserSettingsRequest(param.request)
    ]
  ];
}
export function approveChannelAndIssueChannelToken_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.channelId
    ]
  ];
}
export function authenticateUsingBankAccountEx_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      r80_EnumC34362b(param.type)
    ],
    [
      11,
      2,
      param.bankId
    ],
    [
      11,
      3,
      param.bankBranchId
    ],
    [
      11,
      4,
      param.realAccountNo
    ],
    [
      8,
      5,
      r80_EnumC34361a(param.accountProductCode)
    ],
    [
      11,
      6,
      param.authToken
    ]
  ];
}
export function authenticateWithPaak_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      AuthenticateWithPaakRequest(param.request)
    ]
  ];
}
export function blockContact_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.id
    ]
  ];
}
export function blockRecommendation_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.targetMid
    ]
  ];
}
export function bulkFollow_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      BulkFollowRequest(param.bulkFollowRequest)
    ]
  ];
}
export function bulkGetSetting_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      BulkGetRequest(param.request)
    ]
  ];
}
export function bulkSetSetting_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function buyMustbuyProduct_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      BuyMustbuyRequest(param.request)
    ]
  ];
}
export function canCreateCombinationSticker_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      CanCreateCombinationStickerRequest(param.request)
    ]
  ];
}
export function canReceivePresent_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.shopId
    ],
    [
      11,
      3,
      param.productId
    ],
    [
      12,
      4,
      Locale(param.locale)
    ],
    [
      11,
      5,
      param.recipientMid
    ]
  ];
}
export function cancelChatInvitation_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CancelChatInvitationRequest(param.request)
    ]
  ];
}
export function cancelPaakAuth_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CancelPaakAuthRequest(param.request)
    ]
  ];
}
export function cancelPaakAuthentication_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CancelPaakAuthenticationRequest(param.request)
    ]
  ];
}
export function cancelPinCode_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CancelPinCodeRequest(param.request)
    ]
  ];
}
export function cancelReaction_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CancelReactionRequest(param.cancelReactionRequest)
    ]
  ];
}
export function changeSubscription_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function changeVerificationMethod_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.sessionId
    ],
    [
      8,
      3,
      VerificationMethod(param.method)
    ]
  ];
}
export function checkCanUnregisterEx_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      r80_n0(param.type)
    ]
  ];
}
export function checkEmailAssigned_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      AccountIdentifier(param.accountIdentifier)
    ]
  ];
}
export function checkIfEncryptedE2EEKeyReceived_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CheckIfEncryptedE2EEKeyReceivedRequest(param.request)
    ]
  ];
}
export function checkIfPasswordSetVerificationEmailVerified_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ]
  ];
}
export function checkIfPhonePinCodeMsgVerified_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CheckIfPhonePinCodeMsgVerifiedRequest(param.request)
    ]
  ];
}
export function checkOperationTimeEx_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      r80_EnumC34368h(param.type)
    ],
    [
      11,
      2,
      param.lpAccountNo
    ],
    [
      8,
      3,
      r80_EnumC34371k(param.channelType)
    ]
  ];
}
export function checkUserAgeAfterApprovalWithDocomoV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CheckUserAgeAfterApprovalWithDocomoV2Request(param.request)
    ]
  ];
}
export function checkUserAgeWithDocomoV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CheckUserAgeWithDocomoV2Request(param.request)
    ]
  ];
}
export function checkUserAge_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      2,
      CarrierCode(param.carrier)
    ],
    [
      11,
      3,
      param.sessionId
    ],
    [
      11,
      4,
      param.verifier
    ],
    [
      8,
      5,
      param.standardAge
    ]
  ];
}
export function clearRingtone_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.oid
    ]
  ];
}
export function confirmIdentifier_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.authSessionId
    ],
    [
      12,
      3,
      IdentityCredentialRequest(param.request)
    ]
  ];
}
export function connectEapAccount_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ConnectEapAccountRequest(param.request)
    ]
  ];
}
export function createChatRoomAnnouncement_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.chatRoomMid
    ],
    [
      8,
      3,
      Pb1_X2(param.type)
    ],
    [
      12,
      4,
      ChatRoomAnnouncementContents(param.contents)
    ]
  ];
}
export function createChat_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CreateChatRequest(param.request)
    ]
  ];
}
export function createCollectionForUser_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function createCombinationSticker_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function createE2EEKeyBackupEnforced_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      Pb1_C13263z3(param.request)
    ]
  ];
}
export function createGroupCallUrl_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      CreateGroupCallUrlRequest(param.request)
    ]
  ];
}
export function createLifetimeKeyBackup_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      Pb1_E3(param.request)
    ]
  ];
}
export function createMultiProfile_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CreateMultiProfileRequest(param.request)
    ]
  ];
}
export function createRoomV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      15,
      2,
      [
        11,
        param.contactIds
      ]
    ]
  ];
}
export function createSession_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      h80_C25643c(param.request)
    ]
  ];
}
export function decryptFollowEMid_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.eMid
    ]
  ];
}
export function deleteE2EEKeyBackup_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      Pb1_H3(param.request)
    ]
  ];
}
export function deleteGroupCallUrl_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      DeleteGroupCallUrlRequest(param.request)
    ]
  ];
}
export function deleteMultiProfile_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      DeleteMultiProfileRequest(param.request)
    ]
  ];
}
export function deleteOtherFromChat_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      DeleteOtherFromChatRequest(param.request)
    ]
  ];
}
export function deletePrimaryCredential_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      R70_c(param.request)
    ]
  ];
}
export function deleteSafetyStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      DeleteSafetyStatusRequest(param.req)
    ]
  ];
}
export function deleteSelfFromChat_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      DeleteSelfFromChatRequest(param.request)
    ]
  ];
}
export function determineMediaMessageFlow_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      DetermineMediaMessageFlowRequest(param.request)
    ]
  ];
}
export function disconnectEapAccount_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      DisconnectEapAccountRequest(param.request)
    ]
  ];
}
export function editItemsInCollection_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function enablePointForOneTimeKey_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      2,
      1,
      param.usePoint
    ]
  ];
}
export function establishE2EESession_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function existPinCode_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      S70_b(param.request)
    ]
  ];
}
export function fetchOperations_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      FetchOperationsRequest(param.request)
    ]
  ];
}
export function fetchPhonePinCodeMsg_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      FetchPhonePinCodeMsgRequest(param.request)
    ]
  ];
}
export function findBuddyContactsByQuery_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.language
    ],
    [
      11,
      3,
      param.country
    ],
    [
      11,
      4,
      param.query
    ],
    [
      8,
      5,
      param.fromIndex
    ],
    [
      8,
      6,
      param.count
    ],
    [
      8,
      7,
      Pb1_F0(param.requestSource)
    ]
  ];
}
export function findChatByTicket_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      FindChatByTicketRequest(param.request)
    ]
  ];
}
export function findContactByUserTicket_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.ticketIdWithTag
    ]
  ];
}
export function findContactByUserid_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.searchId
    ]
  ];
}
export function findContactsByPhone_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      2,
      [
        11,
        param.phones
      ]
    ]
  ];
}
export function finishUpdateVerification_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.sessionId
    ]
  ];
}
export function follow_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      FollowRequest(param.followRequest)
    ]
  ];
}
export function generateUserTicket_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      3,
      param.expirationTime
    ],
    [
      8,
      4,
      param.maxUseCount
    ]
  ];
}
export function getAccessToken_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetAccessTokenRequest(param.request)
    ]
  ];
}
export function getAccountBalanceAsync_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.requestToken
    ],
    [
      11,
      2,
      param.accountId
    ]
  ];
}
export function getAcctVerifMethod_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      AccountIdentifier(param.accountIdentifier)
    ]
  ];
}
export function getAllChatMids_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetAllChatMidsRequest(param.request)
    ],
    [
      8,
      2,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getAllContactIds_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getAllowedRegistrationMethod_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      11,
      2,
      param.countryCode
    ]
  ];
}
export function getApprovedChannels_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      2,
      param.lastSynced
    ],
    [
      11,
      3,
      param.locale
    ]
  ];
}
export function getAssertionChallenge_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      m80_l(param.request)
    ]
  ];
}
export function getAttestationChallenge_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      m80_n(param.request)
    ]
  ];
}
export function getAuthRSAKey_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.authSessionId
    ],
    [
      8,
      3,
      IdentityProvider(param.identityProvider)
    ]
  ];
}
export function getAuthorsLatestProducts_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      LatestProductsByAuthorRequest(param.latestProductsByAuthorRequest)
    ]
  ];
}
export function getAutoSuggestionShowcase_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      AutoSuggestionShowcaseRequest(param.autoSuggestionShowcaseRequest)
    ]
  ];
}
export function getBalanceSummaryV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      NZ0_C12208u(param.request)
    ]
  ];
}
export function getBalanceSummaryV4WithPayV3_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      NZ0_C12214w(param.request)
    ]
  ];
}
export function getBalance_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ZQ0_b(param.request)
    ]
  ];
}
export function getBankBranches_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.financialCorpId
    ],
    [
      11,
      2,
      param.query
    ],
    [
      8,
      3,
      param.startNum
    ],
    [
      8,
      4,
      param.count
    ]
  ];
}
export function getBanners_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      BannerRequest(param.request)
    ]
  ];
}
export function getBirthdayEffect_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Eh_C8933a(param.req)
    ]
  ];
}
export function getBleDevice_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetBleDeviceRequest(param.request)
    ]
  ];
}
export function getBlockedContactIds_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getBlockedRecommendationIds_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getBrowsingHistory_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function getBuddyChatBarV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetBuddyChatBarRequest(param.request)
    ]
  ];
}
export function getBuddyDetailWithPersonal_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.buddyMid
    ],
    [
      14,
      2,
      [
        8,
        param.attributeSet && param.attributeSet.map((e)=>Pb1_D0(e))
      ]
    ]
  ];
}
export function getBuddyDetail_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      4,
      param.buddyMid
    ]
  ];
}
export function getBuddyLive_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetBuddyLiveRequest(param.request)
    ]
  ];
}
export function getBuddyOnAir_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      4,
      param.buddyMid
    ]
  ];
}
export function getBuddyStatusBarV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetBuddyStatusBarV2Request(param.request)
    ]
  ];
}
export function getCallStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetCallStatusRequest(param.request)
    ]
  ];
}
export function getCampaign_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetCampaignRequest(param.request)
    ]
  ];
}
export function getChallengeForPaakAuth_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetChallengeForPaakAuthRequest(param.request)
    ]
  ];
}
export function getChallengeForPrimaryReg_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetChallengeForPrimaryRegRequest(param.request)
    ]
  ];
}
export function getChannelContext_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetChannelContextRequest(param.request)
    ]
  ];
}
export function getChannelInfo_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.channelId
    ],
    [
      11,
      3,
      param.locale
    ]
  ];
}
export function getChannelNotificationSettings_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.locale
    ]
  ];
}
export function getChatEffectMetaList_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      1,
      [
        8,
        param.categories && param.categories.map((e)=>Pb1_Q2(e))
      ]
    ]
  ];
}
export function getChatRoomAnnouncementsBulk_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      2,
      [
        11,
        param.chatRoomMids
      ]
    ],
    [
      8,
      3,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getChatRoomAnnouncements_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.chatRoomMid
    ]
  ];
}
export function getChatRoomBGMs_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      2,
      [
        11,
        param.chatRoomMids
      ]
    ],
    [
      8,
      3,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getChatapp_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetChatappRequest(param.request)
    ]
  ];
}
export function getChats_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetChatsRequest(param.request)
    ],
    [
      8,
      2,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getCoinProducts_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetCoinProductsRequest(param.request)
    ]
  ];
}
export function getCoinPurchaseHistory_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetCoinHistoryRequest(param.request)
    ]
  ];
}
export function getCoinUseAndRefundHistory_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetCoinHistoryRequest(param.request)
    ]
  ];
}
export function getCommonDomains_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      1,
      param.lastSynced
    ]
  ];
}
export function getConfigurations_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      2,
      param.revision
    ],
    [
      11,
      3,
      param.regionOfUsim
    ],
    [
      11,
      4,
      param.regionOfTelephone
    ],
    [
      11,
      5,
      param.regionOfLocale
    ],
    [
      11,
      6,
      param.carrier
    ],
    [
      8,
      7,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getContactCalendarEvents_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetContactCalendarEventsRequest(param.request)
    ]
  ];
}
export function getContactsV3_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetContactsV3Request(param.request)
    ]
  ];
}
export function getCountries_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      2,
      Pb1_EnumC13221w3(param.countryGroup)
    ]
  ];
}
export function getCountryInfo_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      11,
      SimCard(param.simCard)
    ]
  ];
}
export function getDataRetention_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      fN0_C24473e(param.req)
    ]
  ];
}
export function getDestinationUrl_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      DestinationLIFFRequest(param.request)
    ]
  ];
}
export function getDisasterCases_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      vh_C37633d(param.req)
    ]
  ];
}
export function getE2EEGroupSharedKey_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      2,
      param.keyVersion
    ],
    [
      11,
      3,
      param.chatMid
    ],
    [
      8,
      4,
      param.groupKeyId
    ]
  ];
}
export function getE2EEKeyBackupCertificates_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      Pb1_W4(param.request)
    ]
  ];
}
export function getE2EEKeyBackupInfo_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      Pb1_Y4(param.request)
    ]
  ];
}
export function getE2EEPublicKey_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.mid
    ],
    [
      8,
      3,
      param.keyVersion
    ],
    [
      8,
      4,
      param.keyId
    ]
  ];
}
export function getExchangeKey_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetExchangeKeyRequest(param.request)
    ]
  ];
}
export function getExtendedProfile_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getFollowBlacklist_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      GetFollowBlacklistRequest(param.getFollowBlacklistRequest)
    ]
  ];
}
export function getFollowers_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      GetFollowersRequest(param.getFollowersRequest)
    ]
  ];
}
export function getFollowings_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      GetFollowingsRequest(param.getFollowingsRequest)
    ]
  ];
}
export function getFontMetas_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetFontMetasRequest(param.request)
    ]
  ];
}
export function getFriendDetails_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetFriendDetailsRequest(param.request)
    ]
  ];
}
export function getFriendRequests_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_F4(param.direction)
    ],
    [
      10,
      2,
      param.lastSeenSeqId
    ]
  ];
}
export function getGnbBadgeStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetGnbBadgeStatusRequest(param.request)
    ]
  ];
}
export function getGroupCallUrlInfo_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      GetGroupCallUrlInfoRequest(param.request)
    ]
  ];
}
export function getGroupCallUrls_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      Pb1_C13042j5(param.request)
    ]
  ];
}
export function getGroupCall_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.chatMid
    ]
  ];
}
export function getHomeFlexContent_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetHomeFlexContentRequest(param.request)
    ]
  ];
}
export function getHomeServiceList_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Eg_C8928b(param.request)
    ]
  ];
}
export function getHomeServices_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetHomeServicesRequest(param.request)
    ]
  ];
}
export function getIncentiveStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      fN0_C24471c(param.req)
    ]
  ];
}
export function getInstantNews_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.region
    ],
    [
      12,
      2,
      Location(param.location)
    ]
  ];
}
export function getJoinedMembershipByBotMid_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetJoinedMembershipByBotMidRequest(param.request)
    ]
  ];
}
export function getJoinedMembership_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetJoinedMembershipRequest(param.request)
    ]
  ];
}
export function getKeyBackupCertificatesV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      Pb1_C13070l5(param.request)
    ]
  ];
}
export function getLFLSuggestion_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function getLastE2EEGroupSharedKey_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      2,
      param.keyVersion
    ],
    [
      11,
      3,
      param.chatMid
    ]
  ];
}
export function getLastE2EEPublicKeys_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.chatMid
    ]
  ];
}
export function getLiffViewWithoutUserContext_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      LiffViewWithoutUserContextRequest(param.request)
    ]
  ];
}
export function getLineCardIssueForm_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      r80_EnumC34372l(param.resolutionType)
    ]
  ];
}
export function getLoginActorContext_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetLoginActorContextRequest(param.request)
    ]
  ];
}
export function getMappedProfileIds_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetMappedProfileIdsRequest(param.request)
    ]
  ];
}
export function getMaskedEmail_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      AccountIdentifier(param.accountIdentifier)
    ]
  ];
}
export function getMessageBoxes_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      MessageBoxListRequest(param.messageBoxListRequest)
    ],
    [
      8,
      3,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getMessageReadRange_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      2,
      [
        11,
        param.chatIds
      ]
    ],
    [
      8,
      3,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getModuleLayoutV4_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetModuleLayoutV4Request(param.request)
    ]
  ];
}
export function getModuleWithStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      NZ0_G(param.request)
    ]
  ];
}
export function getModule_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      NZ0_E(param.request)
    ]
  ];
}
export function getModulesV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetModulesRequestV2(param.request)
    ]
  ];
}
export function getModulesV3_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetModulesRequestV3(param.request)
    ]
  ];
}
export function getModulesV4WithStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetModulesV4WithStatusRequest(param.request)
    ]
  ];
}
export function getMusicSubscriptionStatus_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function getMyAssetInformationV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetMyAssetInformationV2Request(param.request)
    ]
  ];
}
export function getMyChatapps_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetMyChatappsRequest(param.request)
    ]
  ];
}
export function getMyDashboard_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetMyDashboardRequest(param.request)
    ]
  ];
}
export function getNewlyReleasedBuddyIds_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      3,
      param.country
    ]
  ];
}
export function getNotificationSettings_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetNotificationSettingsRequest(param.request)
    ]
  ];
}
export function getOwnedProductSummaries_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.shopId
    ],
    [
      8,
      3,
      param.offset
    ],
    [
      8,
      4,
      param.limit
    ],
    [
      12,
      5,
      Locale(param.locale)
    ]
  ];
}
export function getPasswordHashingParameter_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetPasswordHashingParametersRequest(param.request)
    ]
  ];
}
export function getPasswordHashingParametersForPwdReg_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetPasswordHashingParametersForPwdRegRequest(param.request)
    ]
  ];
}
export function getPasswordHashingParametersForPwdVerif_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetPasswordHashingParametersForPwdVerifRequest(param.request)
    ]
  ];
}
export function getPaymentUrlByKey_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.key
    ]
  ];
}
export function getPhoneVerifMethodForRegistration_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetPhoneVerifMethodForRegistrationRequest(param.request)
    ]
  ];
}
export function getPhoneVerifMethodV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetPhoneVerifMethodV2Request(param.request)
    ]
  ];
}
export function getPhotoboothBalance_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      Pb1_C13126p5(param.request)
    ]
  ];
}
export function getPredefinedScenarioSets_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetPredefinedScenarioSetsRequest(param.request)
    ]
  ];
}
export function getPrefetchableBanners_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      BannerRequest(param.request)
    ]
  ];
}
export function getPremiumStatusForUpgrade_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      fN0_C24475g(param.req)
    ]
  ];
}
export function getPremiumStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      fN0_C24476h(param.req)
    ]
  ];
}
export function getPreviousMessagesV2WithRequest_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      GetPreviousMessagesV2Request(param.request)
    ],
    [
      8,
      3,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getProductByVersion_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.shopId
    ],
    [
      11,
      3,
      param.productId
    ],
    [
      10,
      4,
      param.productVersion
    ],
    [
      12,
      5,
      Locale(param.locale)
    ]
  ];
}
export function getProductLatestVersionForUser_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function getProductSummariesInSubscriptionSlots_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function getProductV2_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function getProductValidationScheme_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.shopId
    ],
    [
      11,
      3,
      param.productId
    ],
    [
      10,
      4,
      param.productVersion
    ]
  ];
}
export function getProductsByAuthor_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function getProfile_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getPromotedBuddyContacts_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.language
    ],
    [
      11,
      3,
      param.country
    ]
  ];
}
export function getPublishedMemberships_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetPublishedMembershipsRequest(param.request)
    ]
  ];
}
export function getPurchaseEnabledStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      PurchaseEnabledRequest(param.request)
    ]
  ];
}
export function getPurchasedProducts_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.shopId
    ],
    [
      8,
      3,
      param.offset
    ],
    [
      8,
      4,
      param.limit
    ],
    [
      12,
      5,
      Locale(param.locale)
    ]
  ];
}
export function getQuickMenu_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      NZ0_S(param.request)
    ]
  ];
}
export function getReceivedPresents_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.shopId
    ],
    [
      8,
      3,
      param.offset
    ],
    [
      8,
      4,
      param.limit
    ],
    [
      12,
      5,
      Locale(param.locale)
    ]
  ];
}
export function getRecentFriendRequests_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getRecommendationDetails_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetRecommendationDetailsRequest(param.request)
    ]
  ];
}
export function getRecommendationIds_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getRecommendationList_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function getRepairElements_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetRepairElementsRequest(param.request)
    ]
  ];
}
export function getResourceFile_args(param) {
  return typeof param === "undefined" ? [] : [];
}
export function getResponseStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetResponseStatusRequest(param.request)
    ]
  ];
}
export function getReturnUrlWithRequestTokenForAutoLogin_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      WebLoginRequest(param.webLoginRequest)
    ]
  ];
}
export function getReturnUrlWithRequestTokenForMultiLiffLogin_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      LiffWebLoginRequest(param.request)
    ]
  ];
}
export function getRoomsV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      2,
      [
        11,
        param.roomIds
      ]
    ]
  ];
}
export function getSCC_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSCCRequest(param.request)
    ]
  ];
}
export function getSeasonalEffects_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Eh_C8935c(param.req)
    ]
  ];
}
export function getSecondAuthMethod_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ]
  ];
}
export function getSentPresents_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.shopId
    ],
    [
      8,
      3,
      param.offset
    ],
    [
      8,
      4,
      param.limit
    ],
    [
      12,
      5,
      Locale(param.locale)
    ]
  ];
}
export function getServiceShortcutMenu_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      NZ0_U(param.request)
    ]
  ];
}
export function getSessionContentBeforeMigCompletion_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ]
  ];
}
export function getSettingsAttributes2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      2,
      [
        8,
        param.attributesToRetrieve && param.attributesToRetrieve.map((e)=>SettingsAttributeEx(e))
      ]
    ]
  ];
}
export function getSettings_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_V7(param.syncReason)
    ]
  ];
}
export function getSmartChannelRecommendations_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSmartChannelRecommendationsRequest(param.request)
    ]
  ];
}
export function getSquareBot_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetSquareBotRequest(param.req)
    ]
  ];
}
export function getStudentInformation_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      Ob1_C12606a0(param.req)
    ]
  ];
}
export function getSubscriptionPlans_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      GetSubscriptionPlansRequest(param.req)
    ]
  ];
}
export function getSubscriptionSlotHistory_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      Ob1_C12618e0(param.req)
    ]
  ];
}
export function getSubscriptionStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      GetSubscriptionStatusRequest(param.req)
    ]
  ];
}
export function getSuggestDictionarySetting_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      Ob1_C12630i0(param.req)
    ]
  ];
}
export function getSuggestResourcesV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      GetSuggestResourcesV2Request(param.req)
    ]
  ];
}
export function getTaiwanBankBalance_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetTaiwanBankBalanceRequest(param.request)
    ]
  ];
}
export function getTargetProfiles_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetTargetProfilesRequest(param.request)
    ]
  ];
}
export function getTargetingPopup_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      NZ0_C12150a0(param.request)
    ]
  ];
}
export function getThaiBankBalance_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetThaiBankBalanceRequest(param.request)
    ]
  ];
}
export function getTotalCoinBalance_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetTotalCoinBalanceRequest(param.request)
    ]
  ];
}
export function getUpdatedChannelIds_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        12,
        param.channelIds && param.channelIds.map((e)=>ChannelIdWithLastUpdated(e))
      ]
    ]
  ];
}
export function getUserCollections_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetUserCollectionsRequest(param.request)
    ]
  ];
}
export function getUserProfile_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      AccountIdentifier(param.accountIdentifier)
    ]
  ];
}
export function getUserVector_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetUserVectorRequest(param.request)
    ]
  ];
}
export function getUsersMappedByProfile_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetUsersMappedByProfileRequest(param.request)
    ]
  ];
}
export function getWebLoginDisallowedUrlForMultiLiffLogin_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      LiffWebLoginRequest(param.request)
    ]
  ];
}
export function getWebLoginDisallowedUrl_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      WebLoginRequest(param.webLoginRequest)
    ]
  ];
}
export function inviteFriends_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      InviteFriendsRequest(param.request)
    ]
  ];
}
export function inviteIntoChat_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      InviteIntoChatRequest(param.request)
    ]
  ];
}
export function inviteIntoGroupCall_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.chatMid
    ],
    [
      15,
      3,
      [
        11,
        param.memberMids
      ]
    ],
    [
      8,
      4,
      Pb1_EnumC13237x5(param.mediaType)
    ]
  ];
}
export function inviteIntoRoom_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.roomId
    ],
    [
      15,
      3,
      [
        11,
        param.contactIds
      ]
    ]
  ];
}
export function isProductForCollections_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      IsProductForCollectionsRequest(param.request)
    ]
  ];
}
export function isStickerAvailableForCombinationSticker_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      IsStickerAvailableForCombinationStickerRequest(param.request)
    ]
  ];
}
export function isUseridAvailable_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.searchId
    ]
  ];
}
export function issueChannelToken_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.channelId
    ]
  ];
}
export function issueLiffView_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      LiffViewRequest(param.request)
    ]
  ];
}
export function issueRequestTokenWithAuthScheme_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.channelId
    ],
    [
      11,
      2,
      param.otpId
    ],
    [
      15,
      3,
      [
        11,
        param.authScheme
      ]
    ],
    [
      11,
      4,
      param.returnUrl
    ]
  ];
}
export function issueSubLiffView_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      LiffViewRequest(param.request)
    ]
  ];
}
export function issueTokenForAccountMigrationSettings_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      2,
      2,
      param.enforce
    ]
  ];
}
export function issueToken_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      IssueBirthdayGiftTokenRequest(param.request)
    ]
  ];
}
export function issueV3TokenForPrimary_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      IssueV3TokenForPrimaryRequest(param.request)
    ]
  ];
}
export function issueWebAuthDetailsForSecondAuth_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ]
  ];
}
export function joinChatByCallUrl_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      JoinChatByCallUrlRequest(param.request)
    ]
  ];
}
export function kickoutFromGroupCall_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      KickoutFromGroupCallRequest(param.kickoutFromGroupCallRequest)
    ]
  ];
}
export function leaveRoom_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.roomId
    ]
  ];
}
export function linkDevice_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      DeviceLinkRequest(param.request)
    ]
  ];
}
export function lookupAvailableEap_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      LookupAvailableEapRequest(param.request)
    ]
  ];
}
export function lookupPaidCall_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.dialedNumber
    ],
    [
      11,
      3,
      param.language
    ],
    [
      11,
      4,
      param.referer
    ]
  ];
}
export function mapProfileToUsers_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      MapProfileToUsersRequest(param.request)
    ]
  ];
}
export function migratePrimaryUsingEapAccountWithTokenV3_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ]
  ];
}
export function migratePrimaryUsingPhoneWithTokenV3_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ]
  ];
}
export function migratePrimaryUsingQrCode_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      MigratePrimaryUsingQrCodeRequest(param.request)
    ]
  ];
}
export function negotiateE2EEPublicKey_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.mid
    ]
  ];
}
export function notifyChatAdEntry_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      NotifyChatAdEntryRequest(param.request)
    ]
  ];
}
export function notifyDeviceConnection_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      NotifyDeviceConnectionRequest(param.request)
    ]
  ];
}
export function notifyDeviceDisconnection_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      NotifyDeviceDisconnectionRequest(param.request)
    ]
  ];
}
export function notifyInstalled_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.udidHash
    ],
    [
      11,
      3,
      param.applicationTypeWithExtensions
    ]
  ];
}
export function notifyOATalkroomEvents_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      NotifyOATalkroomEventsRequest(param.request)
    ]
  ];
}
export function notifyProductEvent_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.shopId
    ],
    [
      11,
      3,
      param.productId
    ],
    [
      10,
      4,
      param.productVersion
    ],
    [
      10,
      5,
      param.productEvent
    ]
  ];
}
export function notifyRegistrationComplete_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.udidHash
    ],
    [
      11,
      3,
      param.applicationTypeWithExtensions
    ]
  ];
}
export function notifyScenarioExecuted_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      NotifyScenarioExecutedRequest(param.request)
    ]
  ];
}
export function notifyUpdated_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      2,
      param.lastRev
    ],
    [
      12,
      3,
      DeviceInfo(param.deviceInfo)
    ],
    [
      11,
      4,
      param.udidHash
    ],
    [
      11,
      5,
      param.oldUdidHash
    ]
  ];
}
export function openAuthSession_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      AuthSessionRequest(param.request)
    ]
  ];
}
export function openSession_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      OpenSessionRequest(param.request)
    ]
  ];
}
export function permitLogin_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      PermitLoginRequest(param.request)
    ]
  ];
}
export function placePurchaseOrderForFreeProduct_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      PurchaseOrder(param.purchaseOrder)
    ]
  ];
}
export function placePurchaseOrderWithLineCoin_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      PurchaseOrder(param.purchaseOrder)
    ]
  ];
}
export function postPopupButtonEvents_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.buttonId
    ],
    [
      13,
      2,
      [
        11,
        2,
        param.checkboxes
      ]
    ]
  ];
}
export function purchaseSubscription_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      PurchaseSubscriptionRequest(param.req)
    ]
  ];
}
export function putE2eeKey_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      PutE2eeKeyRequest(param.request)
    ]
  ];
}
export function react_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ReactRequest(param.reactRequest)
    ]
  ];
}
export function refresh_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RefreshAccessTokenRequest(param.request)
    ]
  ];
}
export function registerBarcodeAsync_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.requestToken
    ],
    [
      11,
      2,
      param.barcodeRequestId
    ],
    [
      11,
      3,
      param.barcode
    ],
    [
      12,
      4,
      RSAEncryptedPassword(param.password)
    ]
  ];
}
export function registerCampaignReward_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RegisterCampaignRewardRequest(param.request)
    ]
  ];
}
export function registerE2EEGroupKey_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      2,
      param.keyVersion
    ],
    [
      11,
      3,
      param.chatMid
    ],
    [
      15,
      4,
      [
        11,
        param.members
      ]
    ],
    [
      15,
      5,
      [
        8,
        param.keyIds
      ]
    ],
    [
      15,
      6,
      [
        11,
        param.encryptedSharedKeys
      ]
    ]
  ];
}
export function registerE2EEPublicKeyV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Pb1_W6(param.request)
    ]
  ];
}
export function registerE2EEPublicKey_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      12,
      2,
      Pb1_C13097n4(param.publicKey)
    ]
  ];
}
export function registerPrimaryCredential_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RegisterPrimaryCredentialRequest(param.request)
    ]
  ];
}
export function registerPrimaryUsingEapAccount_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ]
  ];
}
export function registerPrimaryUsingPhoneWithTokenV3_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.authSessionId
    ]
  ];
}
export function registerUserid_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.searchId
    ]
  ];
}
export function reissueChatTicket_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ReissueChatTicketRequest(param.request)
    ]
  ];
}
export function rejectChatInvitation_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RejectChatInvitationRequest(param.request)
    ]
  ];
}
export function removeChatRoomAnnouncement_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.chatRoomMid
    ],
    [
      10,
      3,
      param.announcementSeq
    ]
  ];
}
export function removeFollower_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      RemoveFollowerRequest(param.removeFollowerRequest)
    ]
  ];
}
export function removeFriendRequest_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_F4(param.direction)
    ],
    [
      11,
      2,
      param.midOrEMid
    ]
  ];
}
export function removeFromFollowBlacklist_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      RemoveFromFollowBlacklistRequest(param.removeFromFollowBlacklistRequest)
    ]
  ];
}
export function removeIdentifier_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.authSessionId
    ],
    [
      12,
      3,
      IdentityCredentialRequest(param.request)
    ]
  ];
}
export function removeItemFromCollection_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RemoveItemFromCollectionRequest(param.request)
    ]
  ];
}
export function removeLinePayAccount_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.accountId
    ]
  ];
}
export function removeProductFromSubscriptionSlot_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      RemoveProductFromSubscriptionSlotRequest(param.req)
    ]
  ];
}
export function reportAbuseEx_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      ReportAbuseExRequest(param.request)
    ]
  ];
}
export function reportDeviceState_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      13,
      2,
      [
        8,
        2,
        param.booleanState
      ]
    ],
    [
      13,
      3,
      [
        8,
        11,
        param.stringState
      ]
    ]
  ];
}
export function reportLocation_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Geolocation(param.location)
    ],
    [
      8,
      2,
      Pb1_EnumC12917a6(param.trigger)
    ],
    [
      12,
      3,
      ClientNetworkStatus(param.networkStatus)
    ],
    [
      10,
      4,
      param.measuredAt
    ],
    [
      10,
      6,
      param.clientCurrentTimestamp
    ],
    [
      12,
      7,
      LocationDebugInfo(param.debugInfo)
    ]
  ];
}
export function reportNetworkStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      Pb1_EnumC12917a6(param.trigger)
    ],
    [
      12,
      2,
      ClientNetworkStatus(param.networkStatus)
    ],
    [
      10,
      3,
      param.measuredAt
    ],
    [
      10,
      4,
      param.scanCompletionTimestamp
    ]
  ];
}
export function reportProfile_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      2,
      param.syncOpRevision
    ],
    [
      12,
      3,
      Profile(param.profile)
    ]
  ];
}
export function reportPushRecvReports_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      15,
      2,
      [
        12,
        param.pushRecvReports && param.pushRecvReports.map((e)=>PushRecvReport(e))
      ]
    ]
  ];
}
export function reportRefreshedAccessToken_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ReportRefreshedAccessTokenRequest(param.request)
    ]
  ];
}
export function reportSettings_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      2,
      param.syncOpRevision
    ],
    [
      12,
      3,
      Settings(param.settings)
    ]
  ];
}
export function requestCleanupUserProvidedData_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      14,
      1,
      [
        8,
        param.dataTypes && param.dataTypes.map((e)=>Pb1_od(e))
      ]
    ]
  ];
}
export function requestToSendPasswordSetVerificationEmail_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      11,
      2,
      param.email
    ],
    [
      12,
      3,
      AccountIdentifier(param.accountIdentifier)
    ]
  ];
}
export function requestToSendPhonePinCode_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ReqToSendPhonePinCodeRequest(param.request)
    ]
  ];
}
export function requestTradeNumber_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.requestToken
    ],
    [
      8,
      2,
      r80_g0(param.requestType)
    ],
    [
      11,
      3,
      param.amount
    ],
    [
      11,
      4,
      param.name
    ]
  ];
}
export function resendIdentifierConfirmation_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.authSessionId
    ],
    [
      12,
      3,
      IdentityCredentialRequest(param.request)
    ]
  ];
}
export function resendPinCode_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.sessionId
    ]
  ];
}
export function reserveCoinPurchase_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      CoinPurchaseReservation(param.request)
    ]
  ];
}
export function reserveSubscriptionPurchase_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ReserveSubscriptionPurchaseRequest(param.request)
    ]
  ];
}
export function reserve_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ReserveRequest(param.request)
    ]
  ];
}
export function restoreE2EEKeyBackup_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      Pb1_C13155r7(param.request)
    ]
  ];
}
export function retrieveRequestTokenWithDocomoV2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      Pb1_C13183t7(param.request)
    ]
  ];
}
export function retrieveRequestToken_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      2,
      CarrierCode(param.carrier)
    ]
  ];
}
export function revokeTokens_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      RevokeTokensRequest(param.request)
    ]
  ];
}
export function saveStudentInformation_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      SaveStudentInformationRequest(param.req)
    ]
  ];
}
export function sendChatChecked_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.seq
    ],
    [
      11,
      2,
      param.chatMid
    ],
    [
      11,
      3,
      param.lastMessageId
    ],
    [
      3,
      4,
      param.sessionId
    ]
  ];
}
export function sendChatRemoved_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.seq
    ],
    [
      11,
      2,
      param.chatMid
    ],
    [
      11,
      3,
      param.lastMessageId
    ],
    [
      3,
      4,
      param.sessionId
    ]
  ];
}
export function sendEncryptedE2EEKey_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      SendEncryptedE2EEKeyRequest(param.request)
    ]
  ];
}
export function sendMessage_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.seq
    ],
    [
      12,
      2,
      Message(param.message)
    ]
  ];
}
export function sendPostback_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      SendPostbackRequest(param.request)
    ]
  ];
}
export function setChatHiddenStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      SetChatHiddenStatusRequest(param.setChatHiddenStatusRequest)
    ]
  ];
}
export function setHashedPassword_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      SetHashedPasswordRequest(param.request)
    ]
  ];
}
export function setIdentifier_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.authSessionId
    ],
    [
      12,
      3,
      IdentityCredentialRequest(param.request)
    ]
  ];
}
export function setNotificationsEnabled_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      8,
      2,
      MIDType(param.type)
    ],
    [
      11,
      3,
      param.target
    ],
    [
      2,
      4,
      param.enablement
    ]
  ];
}
export function setPassword_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      SetPasswordRequest(param.request)
    ]
  ];
}
export function shouldShowWelcomeStickerBanner_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      Ob1_C12660s1(param.request)
    ]
  ];
}
export function startPhotobooth_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      StartPhotoboothRequest(param.request)
    ]
  ];
}
export function startUpdateVerification_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.region
    ],
    [
      8,
      3,
      CarrierCode(param.carrier)
    ],
    [
      11,
      4,
      param.phone
    ],
    [
      11,
      5,
      param.udidHash
    ],
    [
      12,
      6,
      DeviceInfo(param.deviceInfo)
    ],
    [
      11,
      7,
      param.networkCode
    ],
    [
      11,
      8,
      param.locale
    ],
    [
      12,
      9,
      SIMInfo(param.simInfo)
    ]
  ];
}
export function stopBundleSubscription_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      StopBundleSubscriptionRequest(param.request)
    ]
  ];
}
export function storeShareTargetPickerResult_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ShareTargetPickerResultRequest(param.request)
    ]
  ];
}
export function storeSubWindowResult_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      SubWindowResultRequest(param.request)
    ]
  ];
}
export function syncContacts_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      15,
      2,
      [
        12,
        param.localContacts && param.localContacts.map((e)=>ContactModification(e))
      ]
    ]
  ];
}
export function sync_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      SyncRequest(param.request)
    ]
  ];
}
export function tryFriendRequest_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.midOrEMid
    ],
    [
      8,
      2,
      Pb1_G4(param.method)
    ],
    [
      11,
      3,
      param.friendRequestParams
    ]
  ];
}
export function unblockContact_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.id
    ],
    [
      11,
      3,
      param.reference
    ]
  ];
}
export function unblockRecommendation_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.targetMid
    ]
  ];
}
export function unfollow_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      UnfollowRequest(param.unfollowRequest)
    ]
  ];
}
export function unlinkDevice_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      DeviceUnlinkRequest(param.request)
    ]
  ];
}
export function unsendMessage_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.seq
    ],
    [
      11,
      2,
      param.messageId
    ]
  ];
}
export function updateAndGetNearby_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      4,
      2,
      param.latitude
    ],
    [
      4,
      3,
      param.longitude
    ],
    [
      12,
      4,
      GeolocationAccuracy(param.accuracy)
    ],
    [
      12,
      5,
      ClientNetworkStatus(param.networkStatus)
    ],
    [
      4,
      6,
      param.altitudeMeters
    ],
    [
      4,
      7,
      param.velocityMetersPerSecond
    ],
    [
      4,
      8,
      param.bearingDegrees
    ],
    [
      10,
      9,
      param.measuredAtTimestamp
    ],
    [
      10,
      10,
      param.clientCurrentTimestamp
    ]
  ];
}
export function updateChannelNotificationSetting_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        12,
        param.setting && param.setting.map((e)=>ChannelNotificationSetting(e))
      ]
    ]
  ];
}
export function updateChannelSettings_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      ChannelSettings(param.channelSettings)
    ]
  ];
}
export function updateChatRoomBGM_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.chatRoomMid
    ],
    [
      11,
      3,
      param.chatRoomBGMInfo
    ]
  ];
}
export function updateChat_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UpdateChatRequest(param.request)
    ]
  ];
}
export function updateContactSetting_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      11,
      2,
      param.mid
    ],
    [
      8,
      3,
      ContactSetting(param.flag)
    ],
    [
      11,
      4,
      param.value
    ]
  ];
}
export function updateExtendedProfileAttribute_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    ,
    [
      12,
      3,
      ExtendedProfile(param.extendedProfile)
    ]
  ];
}
export function updateGroupCallUrl_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      UpdateGroupCallUrlRequest(param.request)
    ]
  ];
}
export function updateIdentifier_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.authSessionId
    ],
    [
      12,
      3,
      IdentityCredentialRequest(param.request)
    ]
  ];
}
export function updateNotificationToken_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.token
    ],
    [
      8,
      3,
      NotificationType(param.type)
    ]
  ];
}
export function updatePassword_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UpdatePasswordRequest(param.request)
    ]
  ];
}
export function updateProfileAttributes_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      12,
      2,
      UpdateProfileAttributesRequest(param.request)
    ]
  ];
}
export function updateSafetyStatus_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      UpdateSafetyStatusRequest(param.req)
    ]
  ];
}
export function updateSettingsAttributes2_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      8,
      1,
      param.reqSeq
    ],
    [
      12,
      3,
      Settings(param.settings)
    ],
    [
      14,
      4,
      [
        8,
        param.attributesToUpdate && param.attributesToUpdate.map((e)=>SettingsAttributeEx(e))
      ]
    ]
  ];
}
export function updateUserGeneralSettings_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      13,
      1,
      [
        8,
        11,
        param.settings
      ]
    ]
  ];
}
export function usePhotoboothTicket_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      UsePhotoboothTicketRequest(param.request)
    ]
  ];
}
export function validateEligibleFriends_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      15,
      1,
      [
        11,
        param.friends
      ]
    ],
    [
      8,
      2,
      r80_EnumC34376p(param.type)
    ]
  ];
}
export function validateProduct_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.shopId
    ],
    [
      11,
      3,
      param.productId
    ],
    [
      10,
      4,
      param.productVersion
    ]
  ];
}
export function validateProfile_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      11,
      2,
      param.displayName
    ]
  ];
}
export function verifyAccountUsingHashedPwd_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      VerifyAccountUsingHashedPwdRequest(param.request)
    ]
  ];
}
export function verifyAssertion_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      VerifyAssertionRequest(param.request)
    ]
  ];
}
export function verifyAttestation_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      VerifyAttestationRequest(param.request)
    ]
  ];
}
export function verifyBirthdayGiftAssociationToken_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      2,
      BirthdayGiftAssociationVerifyRequest(param.req)
    ]
  ];
}
export function verifyEapAccountForRegistration_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      Device(param.device)
    ],
    [
      12,
      3,
      SocialLogin(param.socialLogin)
    ]
  ];
}
export function verifyEapLogin_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      VerifyEapLoginRequest(param.request)
    ]
  ];
}
export function verifyPhoneNumber_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.sessionId
    ],
    [
      11,
      3,
      param.pinCode
    ],
    [
      11,
      4,
      param.udidHash
    ],
    [
      11,
      5,
      param.migrationPincodeSessionId
    ],
    [
      11,
      6,
      param.oldUdidHash
    ]
  ];
}
export function verifyPhonePinCode_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      VerifyPhonePinCodeRequest(param.request)
    ]
  ];
}
export function verifyPinCode_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      VerifyPinCodeRequest(param.request)
    ]
  ];
}
export function verifyQrCode_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      VerifyQrCodeRequest(param.request)
    ]
  ];
}
export function verifyQrcode_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      2,
      param.verifier
    ],
    [
      11,
      3,
      param.pinCode
    ]
  ];
}
export function verifySocialLogin_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.authSessionId
    ],
    [
      12,
      2,
      Device(param.device)
    ],
    [
      12,
      3,
      SocialLogin(param.socialLogin)
    ]
  ];
}
export function wakeUpLongPolling_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      10,
      2,
      param.clientRevision
    ]
  ];
}
export function F61_EnumC10204a0(param) {
  return typeof param === "string" ? LINETypes.enums.F61_EnumC10204a0[param] : param;
}
export function GetUserFriendIdsRequest(param) {
  return typeof param === "undefined" ? [] : [
    [
      11,
      1,
      param.userPageToken
    ],
    [
      8,
      2,
      F61_EnumC10204a0(param.blockStatus)
    ]
  ];
}
export function getUserFriendIds_args(param) {
  return typeof param === "undefined" ? [] : [
    [
      12,
      1,
      GetUserFriendIdsRequest(param.request)
    ]
  ];
}
//# sourceMappingURL=struct.js.map
