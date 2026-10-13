export default function Avatar({ user, size = 'h-16 w-16' }) {
  return user.profileImage ? (
    <img src={user.profileImage} alt="" className={`${size} rounded-full object-cover`} />
  ) : (
    <span
      aria-hidden="true"
      className={`${size} flex items-center justify-center rounded-full bg-green-100 text-xl font-semibold text-green-800`}
    >
      {user.name[0].toUpperCase()}
    </span>
  );
}
