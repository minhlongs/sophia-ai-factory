import Link from 'next/link'

export default function ThankYou() {
  return (
    <div className="min-h-screen bg-white flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10 text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 mb-4">Thank You!</h2>
          <p className="text-gray-600 mb-8">
            Your order has been processed successfully. Check your email for access instructions.
          </p>
          <Link href="/" className="text-indigo-600 hover:text-indigo-500 font-medium">
            Return Home
          </Link>
        </div>
      </div>
    </div>
  )
}
