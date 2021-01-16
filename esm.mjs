import Eris from "./index.js";

export default function(token, options) {
  return new Eris.Client(token, options);
}

export const {
  Base,
  Bucket,
  Call,
  CategoryChannel,
  Channel,
  Client,
  Collection,
  Constants,
  DiscordHTTPError,
  DiscordRESTError,
  ExtendedUser,
  Guild,
  GuildChannel,
  GuildIntegration,
  GuildPreview,
  GuildTemplate,
  Invite,
  Member,
  Message,
  NewsChannel,
  Permission,
  PermissionOverwrite,
  PrivateChannel,
  RequestHandler,
  Role,
  SequentialBucket,
  Shard,
  StoreChannel,
  TextChannel,
  UnavailableGuild,
  User,
  VERSION,
} = Eris;
